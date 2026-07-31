import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/** Params for `create_policy` (camelCase matches Anchor TS client). */
export interface CreatePolicyParams {
  agent: PublicKey;
  /** Unix ts; `0` = never expires. */
  expiresAt: BN | number;
  spendMint: PublicKey;
  /** `0` = unlimited */
  maxPerTransaction: BN | number;
  /** `0` = unlimited */
  maxPerDay: BN | number;
  /** `0` = unlimited */
  maxActionsPerWindow: number;
  /** Required > 0 if rate limit enabled */
  windowSeconds: number;
  programAllowlistEnabled: boolean;
  programAllowlist: PublicKey[];
  programDenylistEnabled: boolean;
  programDenylist: PublicKey[];
  mintAllowlistEnabled: boolean;
  mintAllowlist: PublicKey[];
  /** When true, destination token account owner must be listed. */
  destinationAllowlistEnabled: boolean;
  /** Wallet pubkeys (token account owners), not ATAs. */
  destinationAllowlist: PublicKey[];
}

/** Params for `update_policy` (does not change agent / spend_mint / authority). */
export interface UpdatePolicyParams {
  expiresAt: BN | number;
  maxPerTransaction: BN | number;
  maxPerDay: BN | number;
  maxActionsPerWindow: number;
  windowSeconds: number;
  programAllowlistEnabled: boolean;
  programAllowlist: PublicKey[];
  programDenylistEnabled: boolean;
  programDenylist: PublicKey[];
  mintAllowlistEnabled: boolean;
  mintAllowlist: PublicKey[];
  destinationAllowlistEnabled: boolean;
  destinationAllowlist: PublicKey[];
}

/** Decoded on-chain Policy account (camelCase). */
export interface PolicyAccount {
  authority: PublicKey;
  agent: PublicKey;
  policyId: BN;
  bump: number;
  paused: boolean;
  createdAt: BN;
  expiresAt: BN;
  spendMint: PublicKey;
  maxPerTransaction: BN;
  maxPerDay: BN;
  spentToday: BN;
  dayStartTs: BN;
  totalSpent: BN;
  maxActionsPerWindow: number;
  windowSeconds: number;
  actionsInWindow: number;
  windowStartTs: BN;
  programAllowlistEnabled: boolean;
  programAllowlist: PublicKey[];
  programDenylistEnabled: boolean;
  programDenylist: PublicKey[];
  mintAllowlistEnabled: boolean;
  mintAllowlist: PublicKey[];
  destinationAllowlistEnabled: boolean;
  destinationAllowlist: PublicKey[];
}

/** Client-side status snapshot for dashboards and agents. */
export interface PolicyStatus {
  address: PublicKey;
  policy: PolicyAccount;
  isActive: boolean;
  isPaused: boolean;
  isExpired: boolean;
  /** Remaining daily budget for spend_mint; null if unlimited. */
  remainingDaily: BN | null;
  /** Remaining actions in rate window; null if unlimited. */
  remainingActions: number | null;
  spentToday: BN;
  totalSpent: BN;
  maxPerTransaction: BN;
  maxPerDay: BN;
  agent: PublicKey;
  authority: PublicKey;
  spendMint: PublicKey;
  programAllowlist: PublicKey[];
  mintAllowlist: PublicKey[];
  destinationAllowlist: PublicKey[];
  destinationAllowlistEnabled: boolean;
  /** Human-readable reason when not active. */
  inactiveReason?: string;
}

export interface ExecuteSpendArgs {
  policy: PublicKey;
  mint: PublicKey;
  amount: BN | number | bigint;
  /** Program the agent intends to use (e.g. Jupiter). Checked against allow/deny lists. */
  intentProgram: PublicKey;
  /** Destination token account (same mint). */
  destination: PublicKey;
  /** Optional agent signer override (defaults to provider wallet). */
  agent?: PublicKey;
}

export interface DepositArgs {
  policy: PublicKey;
  mint: PublicKey;
  amount: BN | number | bigint;
  /** Depositor's token account; defaults to ATA of provider wallet. */
  depositorToken?: PublicKey;
  /** Vault ATA; defaults to ATA(policy, mint). Created client-side if missing. */
  vaultToken?: PublicKey;
}

export interface ClawbackArgs {
  policy: PublicKey;
  mint: PublicKey;
  amount: BN | number | bigint;
  /** Authority destination token account; defaults to ATA of provider wallet. */
  destinationToken?: PublicKey;
  vaultToken?: PublicKey;
}
