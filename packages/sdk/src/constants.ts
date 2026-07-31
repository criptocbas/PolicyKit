import { PublicKey } from "@solana/web3.js";

/** Default PolicyKit program id (localnet / devnet keypair in repo). */
export const POLICYKIT_PROGRAM_ID = new PublicKey(
  "AoTJDX2z2ej5r4UUKCofEbgDUXApWpGhQnvfk8seZf27"
);

/** PDA seed prefix for Policy accounts. */
export const POLICY_SEED = Buffer.from("policy");

/** Day window used by on-chain daily spend accounting (seconds). */
export const SECONDS_PER_DAY = 86_400;

/** Max program IDs on allow or deny lists (on-chain). */
export const MAX_PROGRAM_LIST = 10;

/** Max mints on the mint allowlist (on-chain). */
export const MAX_MINT_LIST = 10;

/** Well-known program IDs useful as intent_program values. */
export const KNOWN_PROGRAMS = {
  /** Jupiter aggregator v6 */
  JUPITER_V6: new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
  /** Drift protocol */
  DRIFT: new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"),
  /** System program (not a useful spend intent; useful in denylist demos) */
  SYSTEM: new PublicKey("11111111111111111111111111111111"),
} as const;
