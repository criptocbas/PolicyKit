import { expect } from "chai";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import {
  refreshPolicyWindows,
  remainingDaily,
  remainingActions,
  isActive,
  isExpired,
  previewSpend,
} from "../src/helpers";
import { SECONDS_PER_DAY, KNOWN_PROGRAMS } from "../src/constants";
import type { PolicyAccount } from "../src/types";

const AUTHORITY = new PublicKey("11111111111111111111111111111112");
const AGENT = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SPEND_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const OTHER_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const JUPITER = KNOWN_PROGRAMS.JUPITER_V6;
const DRIFT = KNOWN_PROGRAMS.DRIFT;

function makePolicy(overrides: Partial<PolicyAccount> = {}): PolicyAccount {
  const dayStart = 1_700_000_000;
  return {
    authority: AUTHORITY,
    agent: AGENT,
    policyId: new BN(1),
    bump: 255,
    paused: false,
    createdAt: new BN(dayStart),
    expiresAt: new BN(0),
    spendMint: SPEND_MINT,
    maxPerTransaction: new BN(20_000_000),
    maxPerDay: new BN(50_000_000),
    spentToday: new BN(10_000_000),
    dayStartTs: new BN(dayStart),
    totalSpent: new BN(10_000_000),
    maxActionsPerWindow: 10,
    windowSeconds: 60,
    actionsInWindow: 3,
    windowStartTs: new BN(dayStart),
    programAllowlistEnabled: true,
    programAllowlist: [JUPITER],
    programDenylistEnabled: false,
    programDenylist: [],
    mintAllowlistEnabled: false,
    mintAllowlist: [],
    ...overrides,
  };
}

describe("refreshPolicyWindows / remaining*", () => {
  const dayStart = 1_700_000_000;

  it("does not reset spentToday when day window not elapsed", () => {
    const p = makePolicy({ dayStartTs: new BN(dayStart), spentToday: new BN(10_000_000) });
    const now = dayStart + SECONDS_PER_DAY - 1;
    const refreshed = refreshPolicyWindows(p, now);
    expect(refreshed.spentToday.toNumber()).to.equal(10_000_000);
    expect(refreshed.dayStartTs.toNumber()).to.equal(dayStart);
    expect(remainingDaily(p, now)!.toNumber()).to.equal(40_000_000);
  });

  it("resets spentToday when day window elapses by exactly 86400", () => {
    const p = makePolicy({ dayStartTs: new BN(dayStart), spentToday: new BN(10_000_000) });
    const now = dayStart + SECONDS_PER_DAY;
    const refreshed = refreshPolicyWindows(p, now);
    expect(refreshed.spentToday.toNumber()).to.equal(0);
    expect(refreshed.dayStartTs.toNumber()).to.equal(dayStart + SECONDS_PER_DAY);
    expect(remainingDaily(p, now)!.toNumber()).to.equal(50_000_000);
  });

  it("advances dayStartTs by whole periods for multi-day elapsed", () => {
    const p = makePolicy({ dayStartTs: new BN(dayStart), spentToday: new BN(5_000_000) });
    const now = dayStart + SECONDS_PER_DAY * 3 + 100;
    const refreshed = refreshPolicyWindows(p, now);
    expect(refreshed.spentToday.toNumber()).to.equal(0);
    expect(refreshed.dayStartTs.toNumber()).to.equal(dayStart + SECONDS_PER_DAY * 3);
  });

  it("does not reset rate window when not elapsed", () => {
    const p = makePolicy({
      windowStartTs: new BN(dayStart),
      windowSeconds: 60,
      actionsInWindow: 3,
    });
    const now = dayStart + 59;
    const refreshed = refreshPolicyWindows(p, now);
    expect(refreshed.actionsInWindow).to.equal(3);
    expect(remainingActions(p, now)).to.equal(7);
  });

  it("resets rate window when elapsed (windowStartTs = now)", () => {
    const p = makePolicy({
      windowStartTs: new BN(dayStart),
      windowSeconds: 60,
      actionsInWindow: 3,
    });
    const now = dayStart + 60;
    const refreshed = refreshPolicyWindows(p, now);
    expect(refreshed.actionsInWindow).to.equal(0);
    expect(refreshed.windowStartTs.toNumber()).to.equal(now);
    expect(remainingActions(p, now)).to.equal(10);
  });

  it("remainingDaily is null when maxPerDay is 0 (unlimited)", () => {
    const p = makePolicy({ maxPerDay: new BN(0), spentToday: new BN(99) });
    expect(remainingDaily(p, dayStart)).to.equal(null);
  });

  it("remainingActions is null when maxActionsPerWindow is 0", () => {
    const p = makePolicy({ maxActionsPerWindow: 0, actionsInWindow: 5 });
    expect(remainingActions(p, dayStart)).to.equal(null);
  });
});

describe("isExpired / isActive", () => {
  it("expiresAt = 0 never expires", () => {
    const p = makePolicy({ expiresAt: new BN(0) });
    expect(isExpired(p, 9_999_999_999)).to.equal(false);
    expect(isActive(p, 9_999_999_999)).to.equal(true);
  });

  it("is expired when now >= expiresAt", () => {
    const exp = 1_800_000_000;
    const p = makePolicy({ expiresAt: new BN(exp) });
    expect(isExpired(p, exp)).to.equal(true);
    expect(isExpired(p, exp - 1)).to.equal(false);
  });

  it("isActive false when paused or expired", () => {
    expect(isActive(makePolicy({ paused: true }), 1_700_000_000)).to.equal(false);
    expect(
      isActive(makePolicy({ expiresAt: new BN(1_700_000_000) }), 1_700_000_000)
    ).to.equal(false);
  });
});

describe("previewSpend", () => {
  const now = 1_700_000_000;

  it("rejects over per-tx limit", () => {
    const r = previewSpend(makePolicy(), {
      amount: 21_000_000,
      mint: SPEND_MINT,
      intentProgram: JUPITER,
      nowSec: now,
    });
    expect(r.ok).to.equal(false);
    if (!r.ok) expect(r.errorName).to.equal("ExceedsPerTransactionLimit");
  });

  it("rejects over daily limit", () => {
    const r = previewSpend(makePolicy({ spentToday: new BN(40_000_000) }), {
      amount: 15_000_000,
      mint: SPEND_MINT,
      intentProgram: JUPITER,
      nowSec: now,
    });
    expect(r.ok).to.equal(false);
    if (!r.ok) expect(r.errorName).to.equal("ExceedsDailyLimit");
  });

  it("rejects paused policy", () => {
    const r = previewSpend(makePolicy({ paused: true }), {
      amount: 1_000_000,
      mint: SPEND_MINT,
      intentProgram: JUPITER,
      nowSec: now,
    });
    expect(r.ok).to.equal(false);
    if (!r.ok) expect(r.errorName).to.equal("PolicyPaused");
  });

  it("rejects expired policy", () => {
    const r = previewSpend(makePolicy({ expiresAt: new BN(now) }), {
      amount: 1_000_000,
      mint: SPEND_MINT,
      intentProgram: JUPITER,
      nowSec: now,
    });
    expect(r.ok).to.equal(false);
    if (!r.ok) expect(r.errorName).to.equal("PolicyExpired");
  });

  it("rejects wrong mint (SpendMintRequired)", () => {
    const r = previewSpend(makePolicy(), {
      amount: 1_000_000,
      mint: OTHER_MINT,
      intentProgram: JUPITER,
      nowSec: now,
    });
    expect(r.ok).to.equal(false);
    if (!r.ok) expect(r.errorName).to.equal("SpendMintRequired");
  });

  it("rejects program not on allowlist", () => {
    const r = previewSpend(makePolicy(), {
      amount: 1_000_000,
      mint: SPEND_MINT,
      intentProgram: DRIFT,
      nowSec: now,
    });
    expect(r.ok).to.equal(false);
    if (!r.ok) expect(r.errorName).to.equal("ProgramNotAllowed");
  });

  it("accepts valid spend", () => {
    const r = previewSpend(makePolicy(), {
      amount: 5_000_000,
      mint: SPEND_MINT,
      intentProgram: JUPITER,
      vaultBalance: 100_000_000,
      nowSec: now,
    });
    expect(r).to.deep.equal({ ok: true });
  });
});
