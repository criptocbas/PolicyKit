import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PolicyKitClient, computeMaxDamage, type MaxDamageReport } from "@policykit/sdk";
import { PROGRAM_ID, RPC_URL } from "./config";

/** Read-only PolicyKit client (no wallet) for public pages. */
export function createReadonlyClient(
  rpcUrl: string = RPC_URL
): { connection: Connection; client: PolicyKitClient } {
  const connection = new Connection(rpcUrl, "confirmed");
  // Dummy wallet — never used for signing on public reads
  const dummy = {
    publicKey: PublicKey.default,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
  const provider = new AnchorProvider(
    connection,
    dummy as AnchorProvider["wallet"],
    { commitment: "confirmed" }
  );
  const client = new PolicyKitClient(provider, PROGRAM_ID);
  return { connection, client };
}

export async function fetchPublicPolicy(address: string) {
  const { client } = createReadonlyClient();
  const policy = new PublicKey(address);
  const status = await client.getPolicyStatus(policy);
  const vaultBalance = await client.getVaultBalance(policy, status.spendMint);
  const maxDamage: MaxDamageReport = computeMaxDamage(status.policy);
  return { status, vaultBalance, maxDamage };
}
