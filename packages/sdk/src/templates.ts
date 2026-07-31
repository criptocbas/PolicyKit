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

function ui(amount: number, decimals: number): BN {
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
