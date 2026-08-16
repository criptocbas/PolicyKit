import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { CreatePolicyParams } from "./types";
import { KNOWN_PROGRAMS } from "./constants";

export interface TemplateContext {
  agent: PublicKey;
  spendMint: PublicKey;
  /** Token decimals for human → base conversion (default 6 for USDC-like). */
  decimals?: number;
  /** Optional extra allowed programs beyond the template defaults. */
  extraPrograms?: PublicKey[];
  /**
   * Destination token account owners (wallets) allowed to receive spends.
   * Defaults to `[agent]` (agent may only pay itself) when destination allowlist is on.
   */
  destinationOwners?: PublicKey[];
  /** Set false to leave destination allowlist disabled (open destinations). */
  destinationAllowlistEnabled?: boolean;
}

export interface PolicyTemplateMetadata {
  version: 1;
  intendedUse: string;
  riskProfile: "bounded-default";
  assumptions: readonly string[];
}

export const POLICY_TEMPLATE_METADATA: Record<
  "conservativeTrading" | "x402Payments" | "researchLimitedSpend",
  PolicyTemplateMetadata
> = {
  conservativeTrading: {
    version: 1,
    intendedUse: "Small, rate-limited trading-agent vaults",
    riskProfile: "bounded-default",
    assumptions: [
      "Six-decimal spend mint unless overridden",
      "Jupiter is declared intent, not CPI proof",
      "Destination owners are explicitly controlled",
    ],
  },
  x402Payments: {
    version: 1,
    intendedUse: "Low-value API and x402-style payments",
    riskProfile: "bounded-default",
    assumptions: [
      "Integrator supplies the actual facilitator or payment program",
      "Recipient owners are known before production use",
      "HTTP service behavior is outside on-chain enforcement",
    ],
  },
  researchLimitedSpend: {
    version: 1,
    intendedUse: "Short-lived research agents with small budgets",
    riskProfile: "bounded-default",
    assumptions: [
      "Policy is created close to use because expiry is computed at creation",
      "Jupiter is declared intent, not CPI proof",
      "Destination owners are explicitly controlled",
    ],
  },
};

function ui(amount: number, decimals: number): BN {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new RangeError("Token decimals must be an integer from 0 through 18");
  }
  return new BN(amount).mul(new BN(10).pow(new BN(decimals)));
}

function destinationFields(ctx: TemplateContext): Pick<
  CreatePolicyParams,
  "destinationAllowlistEnabled" | "destinationAllowlist"
> {
  const enabled = ctx.destinationAllowlistEnabled !== false;
  const list =
    ctx.destinationOwners && ctx.destinationOwners.length > 0
      ? ctx.destinationOwners
      : [ctx.agent];
  return {
    destinationAllowlistEnabled: enabled,
    destinationAllowlist: enabled ? list : [],
  };
}

/**
 * Conservative trading agent: tight daily budget, Jupiter-only, rate limited.
 * Default pitch-demo template. Destination allowlist = agent only.
 */
export function conservativeTradingTemplate(
  ctx: TemplateContext
): CreatePolicyParams {
  const d = ctx.decimals ?? 6;
  const programs = [KNOWN_PROGRAMS.JUPITER_V6, ...(ctx.extraPrograms ?? [])];
  return {
    agent: ctx.agent,
    expiresAt: 0,
    spendMint: ctx.spendMint,
    maxPerTransaction: ui(20, d),
    maxPerDay: ui(50, d),
    maxActionsPerWindow: 10,
    windowSeconds: 60,
    programAllowlistEnabled: true,
    programAllowlist: programs,
    programDenylistEnabled: false,
    programDenylist: [],
    mintAllowlistEnabled: true,
    mintAllowlist: [ctx.spendMint],
    ...destinationFields(ctx),
  };
}

/**
 * x402 / API payments only: small per-tx, moderate daily, single mint.
 * Pass the payment facilitator / router as `extraPrograms` or intent later.
 */
export function x402PaymentsTemplate(ctx: TemplateContext): CreatePolicyParams {
  const d = ctx.decimals ?? 6;
  const programs =
    ctx.extraPrograms && ctx.extraPrograms.length > 0
      ? ctx.extraPrograms
      : [KNOWN_PROGRAMS.JUPITER_V6];
  return {
    agent: ctx.agent,
    expiresAt: 0,
    spendMint: ctx.spendMint,
    maxPerTransaction: ui(5, d),
    maxPerDay: ui(25, d),
    maxActionsPerWindow: 30,
    windowSeconds: 60,
    programAllowlistEnabled: true,
    programAllowlist: programs,
    programDenylistEnabled: false,
    programDenylist: [],
    mintAllowlistEnabled: true,
    mintAllowlist: [ctx.spendMint],
    ...destinationFields(ctx),
  };
}

/**
 * Research agent: very small budget, few actions, short expiry (24h).
 */
export function researchLimitedSpendTemplate(
  ctx: TemplateContext
): CreatePolicyParams {
  const d = ctx.decimals ?? 6;
  const now = Math.floor(Date.now() / 1000);
  return {
    agent: ctx.agent,
    expiresAt: now + 24 * 60 * 60,
    spendMint: ctx.spendMint,
    maxPerTransaction: ui(2, d),
    maxPerDay: ui(10, d),
    maxActionsPerWindow: 5,
    windowSeconds: 300,
    programAllowlistEnabled: true,
    programAllowlist: [KNOWN_PROGRAMS.JUPITER_V6, ...(ctx.extraPrograms ?? [])],
    programDenylistEnabled: false,
    programDenylist: [],
    mintAllowlistEnabled: true,
    mintAllowlist: [ctx.spendMint],
    ...destinationFields(ctx),
  };
}

export const POLICY_TEMPLATES = {
  conservativeTrading: conservativeTradingTemplate,
  x402Payments: x402PaymentsTemplate,
  researchLimitedSpend: researchLimitedSpendTemplate,
} as const;

export type PolicyTemplateName = keyof typeof POLICY_TEMPLATES;
