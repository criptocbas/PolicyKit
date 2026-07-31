import { PublicKey } from "@solana/web3.js";
import { POLICYKIT_PROGRAM_ID } from "@policykit/sdk";

/**
 * Configuration for a PolicyKit-enabled agent.
 *
 * The Solana Agent Kit wallet **must** be the policy `agent` key
 * (or you will get UnauthorizedAgent on spend).
 */
export interface PolicyKitPluginConfig {
  /** Policy PDA the agent is bound to. */
  policy: PublicKey | string;
  /** Program id (defaults to repo deploy id). */
  programId?: PublicKey | string;
  /**
   * Default mint for spends when the action omits mint
   * (typically the policy spend_mint / USDC).
   */
  defaultMint?: PublicKey | string;
  /**
   * Default intent program when the agent does not specify one
   * (e.g. Jupiter v6). Prefer always passing intent explicitly.
   */
  defaultIntentProgram?: PublicKey | string;
  /**
   * If true, run client-side `previewSpend` before submitting txs.
   * Failures still ultimately come from the chain; this improves UX.
   * @default true
   */
  clientSidePreflight?: boolean;
}

export interface ResolvedPolicyKitConfig {
  policy: PublicKey;
  programId: PublicKey;
  defaultMint?: PublicKey;
  defaultIntentProgram?: PublicKey;
  clientSidePreflight: boolean;
}

export function resolveConfig(
  config: PolicyKitPluginConfig
): ResolvedPolicyKitConfig {
  return {
    policy: toPk(config.policy),
    programId: config.programId
      ? toPk(config.programId)
      : POLICYKIT_PROGRAM_ID,
    defaultMint: config.defaultMint ? toPk(config.defaultMint) : undefined,
    defaultIntentProgram: config.defaultIntentProgram
      ? toPk(config.defaultIntentProgram)
      : undefined,
    clientSidePreflight: config.clientSidePreflight !== false,
  };
}

function toPk(v: PublicKey | string): PublicKey {
  return typeof v === "string" ? new PublicKey(v) : v;
}
