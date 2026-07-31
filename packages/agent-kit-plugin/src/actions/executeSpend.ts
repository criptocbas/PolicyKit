import { z } from "zod";
import type { Action, SolanaAgentKit } from "solana-agent-kit";
import type { PolicyKitMethods } from "../methods";

/**
 * LLM-facing action: spend vault funds only through PolicyKit.
 */
export function createExecuteSpendAction(
  getMethods: () => PolicyKitMethods
): Action {
  return {
    name: "POLICYKIT_EXECUTE_SPEND",
    similes: [
      "spend under policy",
      "policykit spend",
      "execute spend",
      "transfer from policy vault",
      "pay with policy",
      "agent spend with limits",
      "policy transfer",
    ],
    description:
      "Move tokens from the PolicyKit vault to a destination under full on-chain policy enforcement (spend limits, program allowlist via intent_program, rate limits, pause, expiry). This is the ONLY safe way for the agent to spend vault funds. Always set intentProgram to the program you are about to use (e.g. Jupiter).",
    examples: [
      [
        {
          input: {
            amount: "10000000",
            destination: "AgentWallet1111111111111111111111111111111",
            intentProgram: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
          },
          output: {
            status: "success",
            signature: "5x...",
            message: "Spend executed under PolicyKit...",
            remainingDaily: "40000000",
          },
          explanation:
            "Spend 10 USDC (6 decimals) from the policy vault declaring Jupiter as intent.",
        },
      ],
      [
        {
          input: {
            amount: "100000000",
            destination: "AgentWallet1111111111111111111111111111111",
            intentProgram: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
          },
          output: {
            status: "error",
            errorName: "ExceedsDailyLimit",
            errorTitle: "Over daily budget",
            message: "Amount would exceed the daily spend limit for this policy.",
          },
          explanation:
            "On-chain rejection when the spend would exceed the daily budget — clean demo failure.",
        },
      ],
    ],
    schema: z.object({
      amount: z
        .union([z.string(), z.number()])
        .describe("Amount in base units (raw token amount, not UI units)"),
      destination: z
        .string()
        .optional()
        .describe("Destination wallet public key (ATA derived automatically)"),
      destinationToken: z
        .string()
        .optional()
        .describe("Explicit destination token account address"),
      mint: z
        .string()
        .optional()
        .describe("Mint address; defaults to policy spend_mint"),
      intentProgram: z
        .string()
        .optional()
        .describe(
          "Program ID the agent intends to use next (e.g. Jupiter). Checked against allow/deny lists."
        ),
    }),
    handler: async (_agent: SolanaAgentKit, input: Record<string, any>) => {
      const methods = getMethods();
      return methods.executeSpendUnderPolicy({
        amount: input.amount,
        destination: input.destination,
        destinationToken: input.destinationToken,
        mint: input.mint,
        intentProgram: input.intentProgram,
      });
    },
  };
}
