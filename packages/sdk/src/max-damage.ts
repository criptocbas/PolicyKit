import BN from "bn.js";
import { PolicyAccount } from "./types";
import { remainingDaily } from "./helpers";

/**
 * Human-readable worst-case loss if the agent key is stolen *right now*.
 * Pure client computation from on-chain fields (edge C).
 */
export type MaxDamageReport = {
  /** Max single spend (base units); null = unlimited */
  maxPerAction: BN | null;
  /** Max if agent drains rate window (base units); null if unlimited or no rate limit */
  maxPerRateWindow: BN | null;
  /** Remaining daily budget (base units); null = unlimited */
  remainingDaily: BN | null;
  /** Absolute daily cap (base units); null = unlimited */
  maxPerDay: BN | null;
  /** Destination owners allowed (base58) when list enabled */
  destinationOwners: string[] | null;
  /** Intent programs allowed when list enabled */
  intentPrograms: string[] | null;
  /** Short summary for UI */
  summary: string;
};

export function computeMaxDamage(
  policy: PolicyAccount,
  nowSec: number = Math.floor(Date.now() / 1000)
): MaxDamageReport {
  const maxPerAction = policy.maxPerTransaction.isZero()
    ? null
    : policy.maxPerTransaction;
  const remDaily = remainingDaily(policy, nowSec);
  const maxPerDay = policy.maxPerDay.isZero() ? null : policy.maxPerDay;

  let maxPerRateWindow: BN | null = null;
  if (
    policy.maxActionsPerWindow > 0 &&
    !policy.maxPerTransaction.isZero()
  ) {
    maxPerRateWindow = policy.maxPerTransaction.mul(
      new BN(policy.maxActionsPerWindow)
    );
  }

  const destinationOwners = policy.destinationAllowlistEnabled
    ? (policy.destinationAllowlist ?? []).map((p) => p.toBase58())
    : null;
  const intentPrograms = policy.programAllowlistEnabled
    ? policy.programAllowlist.map((p) => p.toBase58())
    : null;

  const parts: string[] = [];
  if (maxPerAction) {
    parts.push(`≤ ${maxPerAction.toString()} base units per tx`);
  } else {
    parts.push("no per-tx cap");
  }
  if (remDaily !== null) {
    parts.push(`${remDaily.toString()} remaining today`);
  } else if (maxPerDay) {
    parts.push(`daily cap ${maxPerDay.toString()}`);
  } else {
    parts.push("no daily cap");
  }
  if (destinationOwners) {
    parts.push(`pay ${destinationOwners.length} allowed owner(s) only`);
  } else {
    parts.push("any destination owner");
  }

  return {
    maxPerAction,
    maxPerRateWindow,
    remainingDaily: remDaily,
    maxPerDay,
    destinationOwners,
    intentPrograms,
    summary: parts.join(" · "),
  };
}
