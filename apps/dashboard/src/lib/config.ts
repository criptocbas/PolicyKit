import { PublicKey } from "@solana/web3.js";
import { POLICYKIT_PROGRAM_ID } from "@policykit/sdk";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const PROGRAM_ID = process.env.NEXT_PUBLIC_POLICYKIT_PROGRAM_ID
  ? new PublicKey(process.env.NEXT_PUBLIC_POLICYKIT_PROGRAM_ID)
  : POLICYKIT_PROGRAM_ID;

export type ClusterName = "localnet" | "devnet" | "mainnet-beta";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ??
  "devnet") as ClusterName;

export const STORAGE_KEYS = {
  policy: "policykit.dashboard.policy",
  agentSecret: "policykit.dashboard.agentSecret",
  spendMint: "policykit.dashboard.spendMint",
  activity: "policykit.dashboard.activity",
} as const;
