import type { Plugin, SolanaAgentKit } from "solana-agent-kit";
import {
  PolicyKitPluginConfig,
  ResolvedPolicyKitConfig,
  resolveConfig,
} from "./config";
import { createPolicyKitMethods, PolicyKitMethods } from "./methods";
import { createExecuteSpendAction } from "./actions/executeSpend";
import { createGetStatusAction } from "./actions/getStatus";
import { createCheckSpendAction } from "./actions/checkSpend";

/**
 * Create a Solana Agent Kit plugin bound to a specific Policy PDA.
 *
 * Security: this plugin only routes **policy vault** outflows through on-chain
 * `execute_spend`. It does not sandbox other Agent Kit plugins or agent-held
 * balances. Fund the vault, not the agent wallet (fee SOL only on the agent).
 *
 * @example
 * ```ts
 * import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
 * import { createPolicyKitPlugin } from "@policykit/agent-kit-plugin";
 * import { KNOWN_PROGRAMS } from "@policykit/sdk";
 *
 * const agent = new SolanaAgentKit(
 *   new KeypairWallet(agentKeypair, rpcUrl),
 *   rpcUrl,
 *   {}
 * ).use(
 *   createPolicyKitPlugin({
 *     policy: policyPda,
 *     defaultMint: usdcMint,
 *     defaultIntentProgram: KNOWN_PROGRAMS.JUPITER_V6,
 *   })
 * );
 *
 * // Only supported path for vault spends:
 * await agent.methods.executeSpendUnderPolicy({
 *   amount: "10000000",
 *   destination: agent.wallet.publicKey.toBase58(),
 *   intentProgram: KNOWN_PROGRAMS.JUPITER_V6.toBase58(),
 * });
 * ```
 */
export function createPolicyKitPlugin(
  config: PolicyKitPluginConfig
): Plugin & { methods: PolicyKitMethods } {
  let agentRef: SolanaAgentKit | null = null;
  const resolved: ResolvedPolicyKitConfig = resolveConfig(config);

  const methods = createPolicyKitMethods(
    () => {
      if (!agentRef) {
        throw new Error(
          "PolicyKit plugin not initialized — call agent.use(plugin) first"
        );
      }
      return agentRef;
    },
    () => resolved
  );

  const plugin: Plugin & { methods: PolicyKitMethods } = {
    name: "policykit",
    methods,
    actions: [
      createExecuteSpendAction(() => methods),
      createGetStatusAction(() => methods),
      createCheckSpendAction(() => methods),
    ],
    initialize(agent: SolanaAgentKit) {
      agentRef = agent;
      // Store config on agent for debugging / multi-plugin coordination
      (agent as any).__policyKit = {
        policy: resolved.policy.toBase58(),
        programId: resolved.programId.toBase58(),
      };
    },
  };

  return plugin;
}

/**
 * Convenience: configure a PolicyKit-enabled agent in one call.
 * Returns the plugin; caller still does `new SolanaAgentKit(...).use(plugin)`.
 */
export function policyKitEnabledAgentConfig(
  config: PolicyKitPluginConfig
): PolicyKitPluginConfig {
  return config;
}
