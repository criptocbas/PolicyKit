import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { POLICY_SEED, POLICYKIT_PROGRAM_ID } from "./constants";

export type PolicyIdInput = BN | number | bigint | string;

export function toPolicyIdBn(policyId: PolicyIdInput): BN {
  if (BN.isBN(policyId)) return policyId as BN;
  if (typeof policyId === "bigint") return new BN(policyId.toString());
  if (typeof policyId === "string") return new BN(policyId);
  return new BN(policyId);
}

/** Little-endian 8-byte encoding of policy_id (matches on-chain seed). */
export function policyIdToSeed(policyId: PolicyIdInput): Buffer {
  return toPolicyIdBn(policyId).toArrayLike(Buffer, "le", 8);
}

/**
 * Derive the Policy PDA.
 * Seeds: `["policy", authority, policy_id_le_bytes]`
 */
export function findPolicyPda(
  authority: PublicKey,
  policyId: PolicyIdInput,
  programId: PublicKey = POLICYKIT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POLICY_SEED, authority.toBuffer(), policyIdToSeed(policyId)],
    programId
  );
}

/**
 * Vault token account for a policy (classic ATA; allow owner off-curve).
 */
export function findVaultAta(
  policy: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID
): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    policy,
    true,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}
