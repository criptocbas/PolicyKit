import BN from "bn.js";
import { PolicyAccount, PolicyStatus } from "./types";
import { SECONDS_PER_DAY } from "./constants";
import { PublicKey } from "@solana/web3.js";

function bn(v: BN | number): BN {
  return BN.isBN(v) ? (v as BN) : new BN(v);
}

/**
 * Refresh day / rate counters client-side the same way the program does.
 * Used for remaining budget previews without a tx.
 */
export function refreshPolicyWindows(
  policy: PolicyAccount,
  nowSec: number = Math.floor(Date.now() / 1000)
): PolicyAccount {
  const p = { ...policy };
  const dayStart = p.dayStartTs.toNumber();
  if (nowSec >= dayStart + SECONDS_PER_DAY) {
    const elapsed = nowSec - dayStart;
    const periods = Math.floor(elapsed / SECONDS_PER_DAY);
    p.dayStartTs = new BN(dayStart + periods * SECONDS_PER_DAY);
    p.spentToday = new BN(0);
  }
  if (p.windowSeconds > 0) {
    const windowStart = p.windowStartTs.toNumber();
    if (nowSec >= windowStart + p.windowSeconds) {
      p.windowStartTs = new BN(nowSec);
      p.actionsInWindow = 0;
    }
  }
  return p;
}

/** Remaining daily spend budget for spend_mint. `null` = unlimited. */
export function remainingDaily(
  policy: PolicyAccount,
  nowSec?: number
): BN | null {
  const p = refreshPolicyWindows(policy, nowSec);
  if (p.maxPerDay.isZero()) return null;
  return BN.max(new BN(0), p.maxPerDay.sub(p.spentToday));
}

/** Remaining actions in the current rate window. `null` = unlimited. */
export function remainingActions(
  policy: PolicyAccount,
  nowSec?: number
): number | null {
  const p = refreshPolicyWindows(policy, nowSec);
  if (p.maxActionsPerWindow === 0) return null;
  return Math.max(0, p.maxActionsPerWindow - p.actionsInWindow);
}

export function isExpired(
  policy: PolicyAccount,
  nowSec: number = Math.floor(Date.now() / 1000)
): boolean {
  const exp = policy.expiresAt.toNumber();
  return exp !== 0 && nowSec >= exp;
}

export function isActive(
  policy: PolicyAccount,
  nowSec: number = Math.floor(Date.now() / 1000)
): boolean {
  return !policy.paused && !isExpired(policy, nowSec);
}

export function buildPolicyStatus(
  address: PublicKey,
  policy: PolicyAccount,
  nowSec: number = Math.floor(Date.now() / 1000)
): PolicyStatus {
  const p = refreshPolicyWindows(policy, nowSec);
  const paused = p.paused;
  const expired = isExpired(p, nowSec);
  const active = !paused && !expired;

  let inactiveReason: string | undefined;
  if (paused) inactiveReason = "Policy is paused";
  else if (expired) inactiveReason = "Policy has expired";

  return {
    address,
    policy: p,
    isActive: active,
    isPaused: paused,
    isExpired: expired,
    remainingDaily: remainingDaily(p, nowSec),
    remainingActions: remainingActions(p, nowSec),
    spentToday: p.spentToday,
    totalSpent: p.totalSpent,
    maxPerTransaction: p.maxPerTransaction,
    maxPerDay: p.maxPerDay,
    agent: p.agent,
    authority: p.authority,
    spendMint: p.spendMint,
    programAllowlist: p.programAllowlist,
    mintAllowlist: p.mintAllowlist,
    destinationAllowlist: p.destinationAllowlist ?? [],
    destinationAllowlistEnabled: p.destinationAllowlistEnabled ?? false,
    inactiveReason,
  };
}

/** Convert amount helpers for tests/demos. */
export function toBn(amount: BN | number | bigint | string): BN {
  if (BN.isBN(amount)) return amount as BN;
  if (typeof amount === "bigint") return new BN(amount.toString());
  if (typeof amount === "string") return new BN(amount);
  return bn(amount as number | BN);
}

/**
 * Client-side preflight: does this spend look like it would pass?
 * Does not replace on-chain enforcement — vault balance is not checked here
 * unless you pass `vaultBalance`.
 */
export function previewSpend(
  policy: PolicyAccount,
  args: {
    amount: BN | number | bigint;
    mint: PublicKey;
    intentProgram: PublicKey;
    /** Destination token account owner (wallet). Checked against dest allowlist. */
    destinationOwner?: PublicKey;
    vaultBalance?: BN | number | bigint;
    nowSec?: number;
  }
): { ok: true } | { ok: false; reason: string; errorName: string } {
  const now = args.nowSec ?? Math.floor(Date.now() / 1000);
  const p = refreshPolicyWindows(policy, now);
  const amount = toBn(args.amount);

  if (amount.lte(new BN(0))) {
    return { ok: false, reason: "Amount must be > 0", errorName: "ZeroAmount" };
  }
  if (p.paused) {
    return { ok: false, reason: "Policy is paused", errorName: "PolicyPaused" };
  }
  if (isExpired(p, now)) {
    return { ok: false, reason: "Policy has expired", errorName: "PolicyExpired" };
  }
  // MVP: only spend_mint may be spent (matches on-chain SpendMintRequired).
  if (!args.mint.equals(p.spendMint)) {
    return {
      ok: false,
      reason: "Only the policy spend_mint may be transferred via execute_spend",
      errorName: "SpendMintRequired",
    };
  }
  if (p.programAllowlistEnabled) {
    const allowed = p.programAllowlist.some((x) => x.equals(args.intentProgram));
    if (!allowed) {
      return {
        ok: false,
        reason: "Intent program is not on the allowlist",
        errorName: "ProgramNotAllowed",
      };
    }
  }
  if (p.programDenylistEnabled) {
    const denied = p.programDenylist.some((x) => x.equals(args.intentProgram));
    if (denied) {
      return {
        ok: false,
        reason: "Intent program is on the denylist",
        errorName: "ProgramDenied",
      };
    }
  }
  if (p.mintAllowlistEnabled) {
    const okMint = p.mintAllowlist.some((m) => m.equals(args.mint));
    if (!okMint) {
      return {
        ok: false,
        reason: "Mint is not on the allowlist",
        errorName: "MintNotAllowed",
      };
    }
  }
  if (p.destinationAllowlistEnabled) {
    if (!args.destinationOwner) {
      return {
        ok: false,
        reason: "Destination owner required when destination allowlist is enabled",
        errorName: "DestinationNotAllowed",
      };
    }
    const okDest = (p.destinationAllowlist ?? []).some((d) =>
      d.equals(args.destinationOwner!)
    );
    if (!okDest) {
      return {
        ok: false,
        reason: "Destination token account owner is not on the allowlist",
        errorName: "DestinationNotAllowed",
      };
    }
  }
  if (p.maxActionsPerWindow > 0 && p.actionsInWindow >= p.maxActionsPerWindow) {
    return {
      ok: false,
      reason: "Rate limit exceeded",
      errorName: "RateLimitExceeded",
    };
  }
  if (args.mint.equals(p.spendMint)) {
    if (!p.maxPerTransaction.isZero() && amount.gt(p.maxPerTransaction)) {
      return {
        ok: false,
        reason: "Exceeds per-transaction limit",
        errorName: "ExceedsPerTransactionLimit",
      };
    }
    if (!p.maxPerDay.isZero() && p.spentToday.add(amount).gt(p.maxPerDay)) {
      return {
        ok: false,
        reason: "Would exceed daily limit",
        errorName: "ExceedsDailyLimit",
      };
    }
  }
  if (args.vaultBalance !== undefined) {
    const bal = toBn(args.vaultBalance);
    if (amount.gt(bal)) {
      return {
        ok: false,
        reason: "Insufficient vault balance",
        errorName: "InsufficientVaultBalance",
      };
    }
  }
  return { ok: true };
}
