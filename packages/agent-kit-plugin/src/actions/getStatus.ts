import { z } from "zod";
import type { Action, SolanaAgentKit } from "solana-agent-kit";
import type { PolicyKitMethods } from "../methods";

export function createGetStatusAction(
  getMethods: () => PolicyKitMethods
): Action {
  return {
    name: "POLICYKIT_GET_STATUS",
    similes: [
      "policy status",
      "remaining budget",
      "check policy limits",
      "how much can I spend",
      "policykit status",
    ],
    description:
      "Read the current PolicyKit policy status: remaining daily budget, remaining actions in the rate window, pause/expiry state, allowlists.",
    examples: [
      [
        {
          input: {},
          output: {
            status: "success",
            isActive: true,
            remainingDaily: "40000000",
            remainingActions: 8,
          },
          explanation: "Agent checks remaining budget before spending.",
        },
      ],
    ],
    schema: z.object({}),
    handler: async (_agent: SolanaAgentKit, _input: Record<string, any>) => {
      const methods = getMethods();
      try {
        const status = await methods.getPolicyStatus();
        return {
          status: "success",
          ...status.formatted,
        };
      } catch (e) {
        return {
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        };
      }
    },
  };
}
