import {
  AnchorProvider,
  BN,
  Program,
  Idl,
} from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import idlJson from "./idl/policykit.json";
import { POLICYKIT_PROGRAM_ID } from "./constants";
import { findPolicyPda, findVaultAta, PolicyIdInput, toPolicyIdBn } from "./pda";
import {
  ClawbackArgs,
  CreatePolicyParams,
  DepositArgs,
  ExecuteSpendArgs,
  PolicyAccount,
  PolicyStatus,
  UpdatePolicyParams,
} from "./types";
import {
  buildPolicyStatus,
  isActive as isActiveHelper,
  remainingActions as remainingActionsHelper,
  remainingDaily as remainingDailyHelper,
  toBn,
} from "./helpers";
import { toPolicyKitError } from "./errors";

type PolicyKitProgram = Program<Idl>;

function normalizeCreateParams(params: CreatePolicyParams) {
  return {
    agent: params.agent,
    expiresAt: toBn(params.expiresAt),
    spendMint: params.spendMint,
    maxPerTransaction: toBn(params.maxPerTransaction),
    maxPerDay: toBn(params.maxPerDay),
    maxActionsPerWindow: params.maxActionsPerWindow,
    windowSeconds: params.windowSeconds,
    programAllowlistEnabled: params.programAllowlistEnabled,
    programAllowlist: params.programAllowlist,
    programDenylistEnabled: params.programDenylistEnabled,
    programDenylist: params.programDenylist,
    mintAllowlistEnabled: params.mintAllowlistEnabled,
    mintAllowlist: params.mintAllowlist,
  };
}

function normalizeUpdateParams(params: UpdatePolicyParams) {
  return {
    expiresAt: toBn(params.expiresAt),
    maxPerTransaction: toBn(params.maxPerTransaction),
    maxPerDay: toBn(params.maxPerDay),
    maxActionsPerWindow: params.maxActionsPerWindow,
    windowSeconds: params.windowSeconds,
    programAllowlistEnabled: params.programAllowlistEnabled,
    programAllowlist: params.programAllowlist,
    programDenylistEnabled: params.programDenylistEnabled,
    programDenylist: params.programDenylist,
    mintAllowlistEnabled: params.mintAllowlistEnabled,
    mintAllowlist: params.mintAllowlist,
  };
}

/**
 * Typed client for all PolicyKit instructions + read helpers.
 *
 * Security note: value only leaves the vault via `executeSpend` (agent)
 * or `clawback` (authority). Prefer funding the vault, not the agent wallet.
 */
export class PolicyKitClient {
  readonly provider: AnchorProvider;
  readonly program: PolicyKitProgram;
  readonly programId: PublicKey;
  readonly connection: Connection;

  constructor(
    provider: AnchorProvider,
    programId: PublicKey = POLICYKIT_PROGRAM_ID
  ) {
    this.provider = provider;
    this.connection = provider.connection;
    this.programId = programId;
    const idl = { ...(idlJson as Idl), address: programId.toBase58() };
    this.program = new Program(idl, provider) as PolicyKitProgram;
  }

  /** Build from a connection + wallet (Anchor wallet interface). */
  static fromConnection(
    connection: Connection,
    wallet: AnchorProvider["wallet"],
    programId?: PublicKey,
    opts?: ConstructorParameters<typeof AnchorProvider>[2]
  ): PolicyKitClient {
    const provider = new AnchorProvider(connection, wallet, opts ?? {});
    return new PolicyKitClient(provider, programId);
  }

  // ---------------------------------------------------------------------------
  // PDA helpers
  // ---------------------------------------------------------------------------

  policyPda(authority: PublicKey, policyId: PolicyIdInput): PublicKey {
    return findPolicyPda(authority, policyId, this.programId)[0];
  }

  vaultAta(policy: PublicKey, mint: PublicKey): PublicKey {
    return findVaultAta(policy, mint);
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async getPolicy(policy: PublicKey): Promise<PolicyAccount> {
    try {
      const acc = await (this.program.account as any).policy.fetch(policy);
      return acc as PolicyAccount;
    } catch (e) {
      throw toPolicyKitError(e);
    }
  }

  async getPolicyStatus(policy: PublicKey): Promise<PolicyStatus> {
    const data = await this.getPolicy(policy);
    return buildPolicyStatus(policy, data);
  }

  async remainingDaily(policy: PublicKey): Promise<BN | null> {
    const data = await this.getPolicy(policy);
    return remainingDailyHelper(data);
  }

  async remainingActions(policy: PublicKey): Promise<number | null> {
    const data = await this.getPolicy(policy);
    return remainingActionsHelper(data);
  }

  async isActive(policy: PublicKey): Promise<boolean> {
    const data = await this.getPolicy(policy);
    return isActiveHelper(data);
  }

  async getVaultBalance(policy: PublicKey, mint: PublicKey): Promise<BN> {
    const ata = this.vaultAta(policy, mint);
    try {
      const acc = await getAccount(this.connection, ata);
      return new BN(acc.amount.toString());
    } catch {
      return new BN(0);
    }
  }

  // ---------------------------------------------------------------------------
  // Instructions
  // ---------------------------------------------------------------------------

  async createPolicy(
    policyId: PolicyIdInput,
    params: CreatePolicyParams,
    authority: PublicKey = this.provider.wallet.publicKey
  ): Promise<{ signature: string; policy: PublicKey }> {
    const id = toPolicyIdBn(policyId);
    const [policy] = findPolicyPda(authority, id, this.programId);
    try {
      const signature = await this.program.methods
        .createPolicy(id, normalizeCreateParams(params) as any)
        .accounts({
          authority,
          policy,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      return { signature, policy };
    } catch (e) {
      throw toPolicyKitError(e);
    }
  }

  async updatePolicy(
    policy: PublicKey,
    params: UpdatePolicyParams,
    authority: PublicKey = this.provider.wallet.publicKey
  ): Promise<string> {
    try {
      return await this.program.methods
        .updatePolicy(normalizeUpdateParams(params) as any)
        .accounts({ authority, policy })
        .rpc();
    } catch (e) {
      throw toPolicyKitError(e);
    }
  }

  async setAgent(
    policy: PublicKey,
    newAgent: PublicKey,
    authority: PublicKey = this.provider.wallet.publicKey
  ): Promise<string> {
    try {
      return await this.program.methods
        .setAgent(newAgent)
        .accounts({ authority, policy })
        .rpc();
    } catch (e) {
      throw toPolicyKitError(e);
    }
  }

  async pausePolicy(
    policy: PublicKey,
    authority: PublicKey = this.provider.wallet.publicKey
  ): Promise<string> {
    try {
      return await this.program.methods
        .pausePolicy()
        .accounts({ authority, policy })
        .rpc();
    } catch (e) {
      throw toPolicyKitError(e);
    }
  }

  async unpausePolicy(
    policy: PublicKey,
    authority: PublicKey = this.provider.wallet.publicKey
  ): Promise<string> {
    try {
      return await this.program.methods
        .unpausePolicy()
        .accounts({ authority, policy })
        .rpc();
    } catch (e) {
      throw toPolicyKitError(e);
    }
  }

  /**
   * Ensure the vault ATA exists, then deposit `amount` of `mint`.
   * Anyone may deposit; does not grant policy control.
   */
  async deposit(args: DepositArgs): Promise<string> {
    const depositor = this.provider.wallet.publicKey;
    const vaultToken =
      args.vaultToken ?? this.vaultAta(args.policy, args.mint);
    const depositorToken =
      args.depositorToken ??
      getAssociatedTokenAddressSync(args.mint, depositor, false);

    try {
      await this.ensureAta(vaultToken, args.policy, args.mint, depositor);
      return await this.program.methods
        .deposit(toBn(args.amount))
        .accounts({
          depositor,
          policy: args.policy,
          mint: args.mint,
          depositorToken,
          vaultToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    } catch (e) {
      throw toPolicyKitError(e);
    }
  }

  async clawback(args: ClawbackArgs): Promise<string> {
    const authority = this.provider.wallet.publicKey;
    const vaultToken =
      args.vaultToken ?? this.vaultAta(args.policy, args.mint);
    const destinationToken =
      args.destinationToken ??
      getAssociatedTokenAddressSync(args.mint, authority, false);

    try {
      return await this.program.methods
        .clawback(toBn(args.amount))
        .accounts({
          authority,
          policy: args.policy,
          mint: args.mint,
          vaultToken,
          destinationToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    } catch (e) {
      throw toPolicyKitError(e);
    }
  }

  /**
   * Agent spend under full on-chain policy enforcement.
   *
   * Always pass the real `intentProgram` the agent is about to use
   * (e.g. Jupiter). The Agent Kit plugin sets this automatically.
   *
   * If the agent key is not the provider wallet, pass `signers: [agentKeypair]`.
   */
  async executeSpend(
    args: ExecuteSpendArgs & { signers?: Keypair[] }
  ): Promise<string> {
    const agent = args.agent ?? this.provider.wallet.publicKey;
    const vaultToken = this.vaultAta(args.policy, args.mint);

    try {
      const builder = this.program.methods
        .executeSpend(toBn(args.amount), args.intentProgram)
        .accounts({
          agent,
          policy: args.policy,
          mint: args.mint,
          vaultToken,
          destinationToken: args.destination,
          tokenProgram: TOKEN_PROGRAM_ID,
        });
      if (args.signers?.length) {
        builder.signers(args.signers);
      }
      return await builder.rpc();
    } catch (e) {
      throw toPolicyKitError(e);
    }
  }

  /**
   * Build an execute_spend instruction without sending (for custom txs).
   */
  async buildExecuteSpendIx(args: ExecuteSpendArgs) {
    const agent = args.agent ?? this.provider.wallet.publicKey;
    const vaultToken = this.vaultAta(args.policy, args.mint);
    return this.program.methods
      .executeSpend(toBn(args.amount), args.intentProgram)
      .accounts({
        agent,
        policy: args.policy,
        mint: args.mint,
        vaultToken,
        destinationToken: args.destination,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async ensureAta(
    ata: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
    payer: PublicKey
  ): Promise<void> {
    const info = await this.connection.getAccountInfo(ata);
    if (info) return;
    const ix = createAssociatedTokenAccountInstruction(
      payer,
      ata,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const tx = new Transaction().add(ix);
    await this.provider.sendAndConfirm(tx, []);
  }
}
