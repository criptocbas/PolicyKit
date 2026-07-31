import { z } from "zod";
import type { Action, SolanaAgentKit } from "solana-agent-kit";
import type { PolicyKitMethods } from "../methods";

export function createCheckSpendAction(
  getMethods: () => PolicyKitMethods
): Action {
  return {
    name: "POLICYKIT_CHECK_SPEND",
    similes: [
      "can I spend",
      "preview spend",
      "check if spend allowed",
      "will policy allow",
    ],
    description:
      "Client-side preflight of a PolicyKit spend (limits, allowlists, rate). On-chain enforcement is still authoritative; use this to avoid obvious rejections.",
    examples: [
      [
        {
          input: {
            amount: "10000000",
            intentProgram: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
          },
          output: { ok: true, remainingDaily: "50000000" },
          explanation: "Preview a 10 USDC Jupiter-intent spend.",
        },
      ],
    ],
    schema: z.object({
      amount: z.union([z.string(), z.number()]),
      mint: z.string().optional(),
      intentProgram: z.string().optional(),
    }),
    handler: async (_agent: SolanaAgentKit, input: Record<string, any>) => {
      const methods = getMethods();
      try {
        return await methods.checkSpend({
          amount: input.amount,
          mint: input.mint,
          intentProgram: input.intentProgram,
        });
      } catch (e) {
        return {
          ok: false,
          reason: e instanceof Error ? e.message : String(e),
        };
      }
    },
  };
}
