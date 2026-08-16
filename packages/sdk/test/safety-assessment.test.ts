import { expect } from "chai";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { KNOWN_PROGRAMS } from "../src/constants";
import { assessPolicySafety } from "../src/safety-assessment";
import type { PolicyAccount } from "../src/types";

const AUTHORITY = new PublicKey("11111111111111111111111111111112");
const AGENT = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const DESTINATION = new PublicKey("So11111111111111111111111111111111111111112");
const NOW = 1_700_000_000;

function makePolicy(overrides: Partial<PolicyAccount> = {}): PolicyAccount {
  return {
    authority: AUTHORITY,
    agent: AGENT,
    policyId: new BN(1),
    bump: 255,
    paused: false,
    createdAt: new BN(NOW),
    expiresAt: new BN(NOW + 3600),
    spendMint: MINT,
    maxPerTransaction: new BN(5_000_000),
    maxPerDay: new BN(25_000_000),
    spentToday: new BN(5_000_000),
    dayStartTs: new BN(NOW),
    totalSpent: new BN(5_000_000),
    maxActionsPerWindow: 5,
    windowSeconds: 60,
    actionsInWindow: 1,
    windowStartTs: new BN(NOW),
    programAllowlistEnabled: true,
    programAllowlist: [KNOWN_PROGRAMS.JUPITER_V6],
    programDenylistEnabled: false,
    programDenylist: [],
    mintAllowlistEnabled: true,
    mintAllowlist: [MINT],
    destinationAllowlistEnabled: true,
    destinationAllowlist: [DESTINATION],
    ...overrides,
  };
}

describe("assessPolicySafety", () => {
  it("classifies a policy with every recommended control as bounded", () => {
    const result = assessPolicySafety(makePolicy(), { nowSec: NOW });
    expect(result.level).to.equal("bounded");
    expect(result.recommendedControlsEnabled).to.equal(true);
    expect(result.findings.map((item) => item.code)).to.deep.equal([
      "DECLARED_INTENT_ONLY",
    ]);
  });

  it("classifies missing defense-in-depth controls as partially bounded", () => {
    const result = assessPolicySafety(
      makePolicy({
        maxActionsPerWindow: 0,
        destinationAllowlistEnabled: false,
        programAllowlistEnabled: false,
        mintAllowlistEnabled: false,
      }),
      { nowSec: NOW }
    );
    expect(result.level).to.equal("partially-bounded");
    expect(result.findings.map((item) => item.code)).to.include.members([
      "NO_RATE_LIMIT",
      "OPEN_DESTINATIONS",
      "OPEN_PROGRAM_INTENT",
      "OPEN_MINT_LIST",
    ]);
  });

  it("classifies a policy with no monetary caps as unbounded", () => {
    const result = assessPolicySafety(
      makePolicy({
        maxPerTransaction: new BN(0),
        maxPerDay: new BN(0),
      }),
      { nowSec: NOW }
    );
    expect(result.level).to.equal("unbounded");
    expect(result.findings.map((item) => item.code)).to.include.members([
      "NO_TRANSACTION_CAP",
      "NO_DAILY_CAP",
    ]);
  });

  it("treats an invalid enabled rate window as critical", () => {
    const result = assessPolicySafety(
      makePolicy({ maxActionsPerWindow: 5, windowSeconds: 0 }),
      { nowSec: NOW }
    );
    expect(result.level).to.equal("unbounded");
    expect(result.findings.find((item) => item.code === "INVALID_RATE_WINDOW")?.severity)
      .to.equal("critical");
  });

  it("reports controls that safely block all spends as informational", () => {
    const result = assessPolicySafety(
      makePolicy({
        programAllowlist: [],
        destinationAllowlist: [],
        mintAllowlist: [],
      }),
      { nowSec: NOW }
    );
    expect(result.findings.map((item) => item.code)).to.include.members([
      "EMPTY_PROGRAM_ALLOWLIST",
      "EMPTY_DESTINATION_ALLOWLIST",
      "SPEND_MINT_NOT_ALLOWLISTED",
    ]);
    expect(result.findings.filter((item) => item.severity === "critical")).to.be.empty;
  });

  it("reports paused, expired, and invalid-agent state", () => {
    const result = assessPolicySafety(
      makePolicy({
        paused: true,
        expiresAt: new BN(NOW),
        agent: PublicKey.default,
      }),
      { nowSec: NOW }
    );
    expect(result.level).to.equal("unbounded");
    expect(result.findings.map((item) => item.code)).to.include.members([
      "POLICY_PAUSED",
      "POLICY_EXPIRED",
      "INVALID_AGENT",
    ]);
  });

  it("uses remaining actions and daily budget in current-window damage", () => {
    const result = assessPolicySafety(makePolicy(), { nowSec: NOW });
    // 4 actions left × 5m = 20m, exactly the remaining daily budget.
    expect(result.maxDamage.maxPerRateWindow?.toString()).to.equal("20000000");
  });

  it("adds vault context without changing the safety classification", () => {
    const result = assessPolicySafety(makePolicy(), {
      nowSec: NOW,
      vaultBalance: new BN(100_000_000),
    });
    expect(result.level).to.equal("bounded");
    expect(result.findings.map((item) => item.code)).to.include(
      "VAULT_EXCEEDS_REMAINING_DAILY"
    );
  });
});
