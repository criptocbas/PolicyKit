import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PolicyKitClient,
  PolicyKitError,
  POLICYKIT_ERROR_TITLES,
  previewSpend,
  toBn,
  toPolicyKitError,
  type PolicyKitErrorName,
  type PolicyStatus,
} from "@policykit/sdk";
import type { SolanaAgentKit } from "solana-agent-kit";
import type { ResolvedPolicyKitConfig } from "./config";

export interface SpendUnderPolicyInput {
  /** Amount in base units (raw token amount). */
  amount: number | string;
  /** Destination wallet (owner) — ATA is derived unless destinationToken is set. */
  destination?: string;
  /** Explicit destination token account. */
  destinationToken?: string;
  /** Mint to spend; defaults to plugin defaultMint / policy spend_mint. */
  mint?: string;
  /**
   * Program the agent is about to use (Jupiter, Drift, x402 facilitator, …).
   * Required unless defaultIntentProgram is configured.
   */
  intentProgram?: string;
}

export interface SpendUnderPolicyResult {
  status: "success" | "error";
  signature?: string;
  message: string;
  errorName?: string;
  errorTitle?: string;
  remainingDaily?: string | null;
  remainingActions?: number | null;
}

/**
 * Methods attached to `agent.methods` when the PolicyKit plugin is loaded.
 *
 * All value movement from the policy vault MUST go through these methods
 * (which call on-chain `execute_spend`). Do not use raw SPL transfer of vault
 * funds — the agent key is not the vault authority.
 */
export function createPolicyKitMethods(
  getAgent: () => SolanaAgentKit,
  getConfig: () => ResolvedPolicyKitConfig
) {
  function client(): PolicyKitClient {
    const agent = getAgent();
    const cfg = getConfig();
    const wallet = agent.wallet as unknown as Wallet;
    const provider = new AnchorProvider(agent.connection, wallet, {
      commitment: "confirmed",
    });
    return new PolicyKitClient(provider, cfg.programId);
  }

  async function getPolicyStatus(): Promise<
    PolicyStatus & { formatted: Record<string, unknown> }
  > {
    const cfg = getConfig();
    const c = client();
    const status = await c.getPolicyStatus(cfg.policy);
    return {
      ...status,
      formatted: {
        policy: status.address.toBase58(),
        isActive: status.isActive,
        isPaused: status.isPaused,
        isExpired: status.isExpired,
        inactiveReason: status.inactiveReason ?? null,
        remainingDaily: status.remainingDaily?.toString() ?? "unlimited",
        remainingActions:
          status.remainingActions === null
            ? "unlimited"
            : status.remainingActions,
        spentToday: status.spentToday.toString(),
        totalSpent: status.totalSpent.toString(),
        maxPerTransaction: status.maxPerTransaction.toString(),
        maxPerDay: status.maxPerDay.toString(),
        agent: status.agent.toBase58(),
        spendMint: status.spendMint.toBase58(),
        programAllowlist: status.programAllowlist.map((p) => p.toBase58()),
      },
    };
  }

  async function checkSpend(
    input: SpendUnderPolicyInput
  ): Promise<{
    ok: boolean;
    reason?: string;
    errorName?: string;
    remainingDaily?: string | null;
    remainingActions?: number | null;
  }> {
    const cfg = getConfig();
    const c = client();
    const policy = await c.getPolicy(cfg.policy);
    const mint = resolveMint(input, cfg, policy.spendMint);
    const intent = resolveIntent(input, cfg);
    const vaultBalance = await c.getVaultBalance(cfg.policy, mint);
    const amount = toBn(input.amount);
    const preview = previewSpend(policy, {
      amount,
      mint,
      intentProgram: intent,
      vaultBalance,
    });
    const remainingDaily = (
      await c.remainingDaily(cfg.policy)
    )?.toString() ?? null;
    const remainingActions = await c.remainingActions(cfg.policy);

    if (preview.ok) {
      return { ok: true, remainingDaily, remainingActions };
    }
    return {
      ok: false,
      reason: preview.reason,
      errorName: preview.errorName,
      remainingDaily,
      remainingActions,
    };
  }

  /**
   * Force a spend through PolicyKit `execute_spend`.
   * This is the only supported way for the agent to move vault funds.
   */
  async function executeSpendUnderPolicy(
    input: SpendUnderPolicyInput
  ): Promise<SpendUnderPolicyResult> {
    const cfg = getConfig();
    const agent = getAgent();
    const c = client();

    try {
      const policy = await c.getPolicy(cfg.policy);
      const mint = resolveMint(input, cfg, policy.spendMint);
      const intent = resolveIntent(input, cfg);

      // Agent wallet must be the policy agent
      if (!agent.wallet.publicKey.equals(policy.agent)) {
        return {
          status: "error",
          message:
            "Agent wallet is not the policy agent. Configure SolanaAgentKit with the policy agent keypair.",
          errorName: "UnauthorizedAgent",
          errorTitle: "Not agent",
        };
      }

      const amount = toBn(input.amount);

      if (cfg.clientSidePreflight) {
        const vaultBalance = await c.getVaultBalance(cfg.policy, mint);
        const preview = previewSpend(policy, {
          amount,
          mint,
          intentProgram: intent,
          vaultBalance,
        });
        if (!preview.ok) {
          const title =
            POLICYKIT_ERROR_TITLES[
              preview.errorName as PolicyKitErrorName
            ] ?? preview.errorName;
          return {
            status: "error",
            message: preview.reason,
            errorName: preview.errorName,
            errorTitle: title,
            remainingDaily:
              (await c.remainingDaily(cfg.policy))?.toString() ?? null,
            remainingActions: await c.remainingActions(cfg.policy),
          };
        }
      }

      const destination = resolveDestination(input, mint);

      const signature = await c.executeSpend({
        policy: cfg.policy,
        mint,
        amount,
        intentProgram: intent,
        destination,
        agent: agent.wallet.publicKey,
      });

      const status = await c.getPolicyStatus(cfg.policy);
      return {
        status: "success",
        signature,
        message: `Spend executed under PolicyKit. Intent: ${intent.toBase58()}. Remaining daily: ${
          status.remainingDaily?.toString() ?? "unlimited"
        }.`,
        remainingDaily: status.remainingDaily?.toString() ?? null,
        remainingActions: status.remainingActions,
      };
    } catch (e) {
      const err =
        e instanceof PolicyKitError ? e : toPolicyKitError(e);
      let remainingDaily: string | null | undefined;
      let remainingActions: number | null | undefined;
      try {
        const c2 = client();
        remainingDaily =
          (await c2.remainingDaily(cfg.policy))?.toString() ?? null;
        remainingActions = await c2.remainingActions(cfg.policy);
      } catch {
        /* ignore */
      }
      return {
        status: "error",
        message: err.message,
        errorName: err.errorName,
        errorTitle: err.title,
        remainingDaily,
        remainingActions,
      };
    }
  }

  /**
   * Semantic alias: "pay / transfer / fund an action" always routes through PolicyKit.
   * Use this instead of SPL transfer when operating under a policy vault.
   */
  async function policyTransfer(
    input: SpendUnderPolicyInput
  ): Promise<SpendUnderPolicyResult> {
    return executeSpendUnderPolicy(input);
  }

  /**
   * Spend for a named protocol intent (convenience for Jupiter swaps etc.).
   * Still only moves funds vault → destination via execute_spend; the actual
   * swap/CPI is a separate step the agent may take with the received funds.
   */
  async function spendForIntent(
    intentProgram: string,
    amount: number | string,
    destination: string,
    mint?: string
  ): Promise<SpendUnderPolicyResult> {
    return executeSpendUnderPolicy({
      amount,
      destination,
      mint,
      intentProgram,
    });
  }

  return {
    executeSpendUnderPolicy,
    policyTransfer,
    spendForIntent,
    getPolicyStatus,
    checkSpend,
    /** Expose raw client factory for advanced callers. */
    getPolicyKitClient: client,
  };
}

export type PolicyKitMethods = ReturnType<typeof createPolicyKitMethods>;

function resolveMint(
  input: SpendUnderPolicyInput,
  cfg: ResolvedPolicyKitConfig,
  spendMint: PublicKey
): PublicKey {
  if (input.mint) return new PublicKey(input.mint);
  if (cfg.defaultMint) return cfg.defaultMint;
  return spendMint;
}

function resolveIntent(
  input: SpendUnderPolicyInput,
  cfg: ResolvedPolicyKitConfig
): PublicKey {
  if (input.intentProgram) return new PublicKey(input.intentProgram);
  if (cfg.defaultIntentProgram) return cfg.defaultIntentProgram;
  throw new PolicyKitError({
    name: "Unknown",
    code: null,
    title: "Missing intent program",
    message:
      "intentProgram is required (e.g. Jupiter program id). Set defaultIntentProgram on the plugin or pass intentProgram in the action.",
    isPolicyRejection: false,
  });
}

function resolveDestination(
  input: SpendUnderPolicyInput,
  mint: PublicKey
): PublicKey {
  if (input.destinationToken) {
    return new PublicKey(input.destinationToken);
  }
  if (!input.destination) {
    throw new PolicyKitError({
      name: "Unknown",
      code: null,
      title: "Missing destination",
      message: "Provide destination (wallet) or destinationToken (ATA).",
      isPolicyRejection: false,
    });
  }
  const owner = new PublicKey(input.destination);
  return getAssociatedTokenAddressSync(mint, owner, true, TOKEN_PROGRAM_ID);
}
