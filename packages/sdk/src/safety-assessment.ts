import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { computeMaxDamage, MaxDamageReport } from "./max-damage";
import { PolicyAccount } from "./types";

export type PolicySafetyLevel = "bounded" | "partially-bounded" | "unbounded";
export type SafetyFindingSeverity = "critical" | "warning" | "info";

export type PolicySafetyFindingCode =
  | "NO_TRANSACTION_CAP"
  | "NO_DAILY_CAP"
  | "NO_RATE_LIMIT"
  | "INVALID_RATE_WINDOW"
  | "OPEN_DESTINATIONS"
  | "EMPTY_DESTINATION_ALLOWLIST"
  | "OPEN_PROGRAM_INTENT"
  | "EMPTY_PROGRAM_ALLOWLIST"
  | "OPEN_MINT_LIST"
  | "SPEND_MINT_NOT_ALLOWLISTED"
  | "NO_EXPIRY"
  | "POLICY_PAUSED"
  | "POLICY_EXPIRED"
  | "INVALID_AGENT"
  | "DECLARED_INTENT_ONLY"
  | "VAULT_EXCEEDS_REMAINING_DAILY";

export interface PolicySafetyFinding {
  code: PolicySafetyFindingCode;
  severity: SafetyFindingSeverity;
  title: string;
  detail: string;
}

export interface PolicySafetyAssessment {
  level: PolicySafetyLevel;
  findings: PolicySafetyFinding[];
  maxDamage: MaxDamageReport;
  /** True only when every recommended production control is enabled. */
  recommendedControlsEnabled: boolean;
}

export interface PolicySafetyAssessmentOptions {
  nowSec?: number;
  /** Optional vault balance in base units for contextual findings. */
  vaultBalance?: BN;
}

const ZERO_KEY = PublicKey.default;

function finding(
  code: PolicySafetyFindingCode,
  severity: SafetyFindingSeverity,
  title: string,
  detail: string
): PolicySafetyFinding {
  return { code, severity, title, detail };
}

/**
 * Assess whether an on-chain policy uses PolicyKit's recommended production
 * controls. This is deterministic advisory analysis; the program remains the
 * enforcement source of truth.
 */
export function assessPolicySafety(
  policy: PolicyAccount,
  options: PolicySafetyAssessmentOptions = {}
): PolicySafetyAssessment {
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const findings: PolicySafetyFinding[] = [];

  if (policy.maxPerTransaction.isZero()) {
    findings.push(
      finding(
        "NO_TRANSACTION_CAP",
        "warning",
        "No per-transaction cap",
        "A single accepted transaction can drain the available spend mint up to other active limits."
      )
    );
  }
  if (policy.maxPerDay.isZero()) {
    findings.push(
      finding(
        "NO_DAILY_CAP",
        "warning",
        "No daily cap",
        "Repeated accepted transactions have no daily aggregate ceiling."
      )
    );
  }

  if (policy.maxActionsPerWindow === 0) {
    findings.push(
      finding(
        "NO_RATE_LIMIT",
        "warning",
        "No rate limit",
        "The agent can submit unlimited actions within a short interval, subject to other limits."
      )
    );
  } else if (policy.windowSeconds === 0) {
    findings.push(
      finding(
        "INVALID_RATE_WINDOW",
        "critical",
        "Invalid rate window",
        "A non-zero action limit requires a non-zero window."
      )
    );
  }

  if (!policy.destinationAllowlistEnabled) {
    findings.push(
      finding(
        "OPEN_DESTINATIONS",
        "warning",
        "Destination owners are open",
        "An authorized agent can pay any classic SPL token account owner."
      )
    );
  } else if ((policy.destinationAllowlist ?? []).length === 0) {
    findings.push(
      finding(
        "EMPTY_DESTINATION_ALLOWLIST",
        "info",
        "No destination can receive spends",
        "The destination allowlist is enabled but empty, so execute_spend will reject every destination."
      )
    );
  }

  if (!policy.programAllowlistEnabled) {
    findings.push(
      finding(
        "OPEN_PROGRAM_INTENT",
        "warning",
        "Declared program intent is open",
        "Any declared intent program passes unless separately denied."
      )
    );
  } else if (policy.programAllowlist.length === 0) {
    findings.push(
      finding(
        "EMPTY_PROGRAM_ALLOWLIST",
        "info",
        "No program intent is allowed",
        "The program allowlist is enabled but empty, so execute_spend will reject every intent."
      )
    );
  }

  if (!policy.mintAllowlistEnabled) {
    findings.push(
      finding(
        "OPEN_MINT_LIST",
        "warning",
        "Mint allowlist is disabled",
        "The immutable spend_mint still constrains agent spends, but explicit mint defense-in-depth is disabled."
      )
    );
  } else if (!policy.mintAllowlist.some((mint) => mint.equals(policy.spendMint))) {
    findings.push(
      finding(
        "SPEND_MINT_NOT_ALLOWLISTED",
        "info",
        "Spend mint is not allowlisted",
        "The enabled mint allowlist blocks all execute_spend attempts for the immutable spend_mint."
      )
    );
  }

  if (policy.expiresAt.isZero()) {
    findings.push(
      finding(
        "NO_EXPIRY",
        "info",
        "Policy does not expire",
        "The authority must pause or update this policy to end agent access."
      )
    );
  } else if (policy.expiresAt.lten(nowSec)) {
    findings.push(
      finding(
        "POLICY_EXPIRED",
        "info",
        "Policy is expired",
        "Agent spends are currently rejected on-chain."
      )
    );
  }

  if (policy.paused) {
    findings.push(
      finding(
        "POLICY_PAUSED",
        "info",
        "Policy is paused",
        "Agent spends are currently rejected on-chain; authority clawback remains available."
      )
    );
  }

  if (policy.agent.equals(ZERO_KEY)) {
    findings.push(
      finding(
        "INVALID_AGENT",
        "critical",
        "Invalid agent",
        "The default public key is not a valid PolicyKit agent."
      )
    );
  }

  findings.push(
    finding(
      "DECLARED_INTENT_ONLY",
      "info",
      "Program intent is declared",
      "The allowlist checks the agent-supplied intent_program; it does not prove downstream CPI execution."
    )
  );

  const maxDamage = computeMaxDamage(policy, nowSec);
  if (
    options.vaultBalance &&
    maxDamage.remainingDaily &&
    options.vaultBalance.gt(maxDamage.remainingDaily)
  ) {
    findings.push(
      finding(
        "VAULT_EXCEEDS_REMAINING_DAILY",
        "info",
        "Vault exceeds remaining daily budget",
        "The remaining vault balance cannot all leave through agent spends in the current daily window."
      )
    );
  }

  const missingTransactionCap = policy.maxPerTransaction.isZero();
  const missingDailyCap = policy.maxPerDay.isZero();
  const hasCritical = findings.some((item) => item.severity === "critical");
  const hasWarnings = findings.some((item) => item.severity === "warning");
  const level: PolicySafetyLevel =
    hasCritical || (missingTransactionCap && missingDailyCap)
      ? "unbounded"
      : hasWarnings
        ? "partially-bounded"
        : "bounded";

  return {
    level,
    findings,
    maxDamage,
    recommendedControlsEnabled: level === "bounded",
  };
}
