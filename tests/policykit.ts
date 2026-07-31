import * as anchor from "@coral-xyz/anchor";
import { Program, BN, AnchorError } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";
import { expect } from "chai";
import { Policykit } from "../target/types/policykit";

const POLICY_SEED = Buffer.from("policy");

// Well-known program ids used as intent_program in tests (not actually invoked).
const JUPITER_V6 = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const FORBIDDEN_PROGRAM = new PublicKey("11111111111111111111111111111112");
const DRIFT_PROGRAM = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

describe("policykit", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.policykit as Program<Policykit>;
  const connection = provider.connection;

  const authority = (provider.wallet as anchor.Wallet).payer;
  const agent = Keypair.generate();
  const outsider = Keypair.generate();

  let usdcMint: PublicKey;
  let otherMint: PublicKey;
  let authorityUsdc: PublicKey;
  let agentUsdc: PublicKey;
  let agentOther: PublicKey;
  let outsiderUsdc: PublicKey;

  const policyId = new BN(1);
  let policyPda: PublicKey;
  let vaultUsdc: PublicKey;
  let vaultOther: PublicKey;

  const DECIMALS = 6;
  const oneUsdc = (n: number) => new BN(n * 10 ** DECIMALS);

  async function airdrop(pk: PublicKey, sol = 2) {
    const sig = await connection.requestAirdrop(pk, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }

  async function createMint(payer: Keypair, decimals: number): Promise<PublicKey> {
    const mint = Keypair.generate();
    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        mint.publicKey,
        decimals,
        payer.publicKey,
        null,
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(tx, [mint]);
    return mint.publicKey;
  }

  async function createAta(
    mint: PublicKey,
    owner: PublicKey,
    payer: Keypair
  ): Promise<PublicKey> {
    const ata = getAssociatedTokenAddressSync(mint, owner, true);
    const info = await connection.getAccountInfo(ata);
    if (info) return ata;
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(tx, []);
    return ata;
  }

  async function mintTo(mint: PublicKey, dest: PublicKey, amount: number) {
    const tx = new anchor.web3.Transaction().add(
      createMintToInstruction(
        mint,
        dest,
        authority.publicKey,
        amount,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(tx, []);
  }

  function policyAddress(id: BN = policyId): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [POLICY_SEED, authority.publicKey.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    return pda;
  }

  function defaultCreateParams(overrides: Record<string, unknown> = {}) {
    return {
      agent: agent.publicKey,
      expiresAt: new BN(0),
      spendMint: usdcMint,
      maxPerTransaction: oneUsdc(20),
      maxPerDay: oneUsdc(50),
      maxActionsPerWindow: 5,
      windowSeconds: 60,
      programAllowlistEnabled: true,
      programAllowlist: [JUPITER_V6],
      programDenylistEnabled: true,
      programDenylist: [FORBIDDEN_PROGRAM],
      mintAllowlistEnabled: true,
      mintAllowlist: [usdcMint],
      ...overrides,
    };
  }

  async function createPolicyWithParams(
    id: BN,
    params: ReturnType<typeof defaultCreateParams>
  ) {
    const pda = policyAddress(id);
    await program.methods
      .createPolicy(id, params as any)
      .accounts({
        authority: authority.publicKey,
        policy: pda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return pda;
  }

  async function deposit(
    pda: PublicKey,
    mint: PublicKey,
    depositorToken: PublicKey,
    vault: PublicKey,
    amount: BN,
    depositor: Keypair = authority
  ) {
    await program.methods
      .deposit(amount)
      .accounts({
        depositor: depositor.publicKey,
        policy: pda,
        mint,
        depositorToken,
        vaultToken: vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers(depositor === authority ? [] : [depositor])
      .rpc();
  }

  async function executeSpend(
    pda: PublicKey,
    mint: PublicKey,
    vault: PublicKey,
    dest: PublicKey,
    amount: BN,
    intent: PublicKey,
    signer: Keypair = agent
  ) {
    return program.methods
      .executeSpend(amount, intent)
      .accounts({
        agent: signer.publicKey,
        policy: pda,
        mint,
        vaultToken: vault,
        destinationToken: dest,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([signer])
      .rpc();
  }

  function expectError(err: unknown, name: string) {
    if (err instanceof AnchorError) {
      expect(err.error.errorCode.code).to.equal(name);
      return;
    }
    // Some simulation failures surface as SendTransactionError; recover Anchor code from logs.
    const logs: string[] | undefined = (err as { logs?: string[] }).logs;
    const parsed = logs ? AnchorError.parse(logs) : null;
    if (parsed) {
      expect(parsed.error.errorCode.code).to.equal(name);
      return;
    }
    const blob = [
      String((err as { message?: string }).message ?? err),
      ...(logs ?? []),
    ].join("\n");
    expect(blob).to.include(name);
  }

  before(async () => {
    await airdrop(agent.publicKey);
    await airdrop(outsider.publicKey);

    usdcMint = await createMint(authority, DECIMALS);
    otherMint = await createMint(authority, DECIMALS);

    authorityUsdc = await createAta(usdcMint, authority.publicKey, authority);
    agentUsdc = await createAta(usdcMint, agent.publicKey, authority);
    agentOther = await createAta(otherMint, agent.publicKey, authority);
    outsiderUsdc = await createAta(usdcMint, outsider.publicKey, authority);

    // Fund authority with test tokens
    await mintTo(usdcMint, authorityUsdc, 1_000_000_000); // 1000 USDC
    const authorityOther = await createAta(otherMint, authority.publicKey, authority);
    await mintTo(otherMint, authorityOther, 1_000_000_000);

    policyPda = policyAddress();
    vaultUsdc = getAssociatedTokenAddressSync(usdcMint, policyPda, true);
    vaultOther = getAssociatedTokenAddressSync(otherMint, policyPda, true);
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  it("creates a policy with full rule set", async () => {
    await createPolicyWithParams(policyId, defaultCreateParams());

    const policy = await program.account.policy.fetch(policyPda);
    expect(policy.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(policy.agent.toBase58()).to.equal(agent.publicKey.toBase58());
    expect(policy.policyId.toNumber()).to.equal(1);
    expect(policy.paused).to.equal(false);
    expect(policy.maxPerTransaction.toNumber()).to.equal(oneUsdc(20).toNumber());
    expect(policy.maxPerDay.toNumber()).to.equal(oneUsdc(50).toNumber());
    expect(policy.maxActionsPerWindow).to.equal(5);
    expect(policy.programAllowlistEnabled).to.equal(true);
    expect(policy.programAllowlist[0].toBase58()).to.equal(JUPITER_V6.toBase58());
    expect(policy.mintAllowlistEnabled).to.equal(true);
  });

  it("rejects create with empty allowlist when enabled", async () => {
    try {
      await createPolicyWithParams(
        new BN(99),
        defaultCreateParams({
          programAllowlistEnabled: true,
          programAllowlist: [],
        })
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "EmptyProgramAllowlist");
    }
  });

  it("creates vault ATA and accepts deposit", async () => {
    // Create vault ATA (owner = policy PDA)
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        vaultUsdc,
        policyPda,
        usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    await provider.sendAndConfirm(tx, []);

    await deposit(policyPda, usdcMint, authorityUsdc, vaultUsdc, oneUsdc(100));
    const vault = await getAccount(connection, vaultUsdc);
    expect(Number(vault.amount)).to.equal(oneUsdc(100).toNumber());
  });

  // -------------------------------------------------------------------------
  // Happy path spends
  // -------------------------------------------------------------------------

  it("agent executes spend within limits (simulates Jupiter payment)", async () => {
    await executeSpend(
      policyPda,
      usdcMint,
      vaultUsdc,
      agentUsdc,
      oneUsdc(10),
      JUPITER_V6
    );

    const policy = await program.account.policy.fetch(policyPda);
    expect(policy.spentToday.toNumber()).to.equal(oneUsdc(10).toNumber());
    expect(policy.totalSpent.toNumber()).to.equal(oneUsdc(10).toNumber());
    expect(policy.actionsInWindow).to.equal(1);

    const agentBal = await getAccount(connection, agentUsdc);
    expect(Number(agentBal.amount)).to.equal(oneUsdc(10).toNumber());
  });

  it("agent executes a second spend under remaining budget", async () => {
    await executeSpend(
      policyPda,
      usdcMint,
      vaultUsdc,
      agentUsdc,
      oneUsdc(15),
      JUPITER_V6
    );
    const policy = await program.account.policy.fetch(policyPda);
    expect(policy.spentToday.toNumber()).to.equal(oneUsdc(25).toNumber());
    expect(policy.actionsInWindow).to.equal(2);
  });

  // -------------------------------------------------------------------------
  // Spend limits
  // -------------------------------------------------------------------------

  it("rejects spend exceeding per-transaction limit", async () => {
    try {
      await executeSpend(
        policyPda,
        usdcMint,
        vaultUsdc,
        agentUsdc,
        oneUsdc(25), // max is 20
        JUPITER_V6
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "ExceedsPerTransactionLimit");
    }
  });

  it("rejects spend that would exceed daily limit", async () => {
    // spent_today = 25, max_per_day = 50, per-tx max = 20 → 20 would fit per-tx
    // but 25+20=45 OK; need to push over 50
    await executeSpend(
      policyPda,
      usdcMint,
      vaultUsdc,
      agentUsdc,
      oneUsdc(20),
      JUPITER_V6
    );
    // spent_today = 45, remaining daily = 5; try 10
    try {
      await executeSpend(
        policyPda,
        usdcMint,
        vaultUsdc,
        agentUsdc,
        oneUsdc(10),
        JUPITER_V6
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "ExceedsDailyLimit");
    }

    // Exactly remaining (5) should succeed
    await executeSpend(
      policyPda,
      usdcMint,
      vaultUsdc,
      agentUsdc,
      oneUsdc(5),
      JUPITER_V6
    );
    const policy = await program.account.policy.fetch(policyPda);
    expect(policy.spentToday.toNumber()).to.equal(oneUsdc(50).toNumber());
  });

  // -------------------------------------------------------------------------
  // Program allow / deny
  // -------------------------------------------------------------------------

  it("rejects spend with intent program not on allowlist", async () => {
    // Need fresh daily budget — use a new policy
    const id = new BN(2);
    const pda = await createPolicyWithParams(id, defaultCreateParams());
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        vault,
        pda,
        usdcMint
      )
    );
    await provider.sendAndConfirm(tx, []);
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(100));

    try {
      await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), DRIFT_PROGRAM);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "ProgramNotAllowed");
    }
  });

  it("rejects spend with intent program on denylist", async () => {
    const id = new BN(3);
    // Allowlist disabled so denylist is the gate
    const pda = await createPolicyWithParams(
      id,
      defaultCreateParams({
        programAllowlistEnabled: false,
        programAllowlist: [],
        programDenylistEnabled: true,
        programDenylist: [FORBIDDEN_PROGRAM],
      })
    );
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(50));

    try {
      await executeSpend(
        pda,
        usdcMint,
        vault,
        agentUsdc,
        oneUsdc(1),
        FORBIDDEN_PROGRAM
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "ProgramDenied");
    }

    // Non-denied program works
    await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6);
  });

  // -------------------------------------------------------------------------
  // Mint allowlist
  // -------------------------------------------------------------------------

  it("rejects spend of non-spend_mint even if allowlisted (SpendMintRequired)", async () => {
    const id = new BN(4);
    // Allowlist includes both mints — pre-fix hole would have allowed otherMint
    // without daily caps; post-fix only spend_mint is spendable.
    const pda = await createPolicyWithParams(
      id,
      defaultCreateParams({
        mintAllowlistEnabled: true,
        mintAllowlist: [usdcMint, otherMint],
      })
    );
    const vault = getAssociatedTokenAddressSync(otherMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          otherMint
        )
      ),
      []
    );
    const authorityOther = getAssociatedTokenAddressSync(
      otherMint,
      authority.publicKey,
      false
    );
    await deposit(pda, otherMint, authorityOther, vault, oneUsdc(10));

    try {
      await executeSpend(
        pda,
        otherMint,
        vault,
        agentOther,
        oneUsdc(1),
        JUPITER_V6
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "SpendMintRequired");
    }
  });

  it("rejects spend when spend_mint is not on mint allowlist", async () => {
    const id = new BN(40);
    const pda = await createPolicyWithParams(
      id,
      defaultCreateParams({
        mintAllowlistEnabled: true,
        mintAllowlist: [otherMint], // spend_mint (USDC) not listed
      })
    );
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(10));

    try {
      await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "MintNotAllowed");
    }
  });

  it("authority can clawback non-spend_mint from vault", async () => {
    const id = new BN(41);
    const pda = await createPolicyWithParams(id, defaultCreateParams());
    const vault = getAssociatedTokenAddressSync(otherMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          otherMint
        )
      ),
      []
    );
    const authorityOther = getAssociatedTokenAddressSync(
      otherMint,
      authority.publicKey,
      false
    );
    await deposit(pda, otherMint, authorityOther, vault, oneUsdc(10));

    await program.methods
      .clawback(oneUsdc(10))
      .accounts({
        authority: authority.publicKey,
        policy: pda,
        mint: otherMint,
        vaultToken: vault,
        destinationToken: authorityOther,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const vaultAfter = await getAccount(connection, vault);
    expect(Number(vaultAfter.amount)).to.equal(0);
  });

  it("rejects spend to a destination owned by the policy PDA", async () => {
    const id = new BN(42);
    const pda = await createPolicyWithParams(id, defaultCreateParams());
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(20));

    try {
      // destination = vault (policy-owned)
      await executeSpend(pda, usdcMint, vault, vault, oneUsdc(1), JUPITER_V6);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "InvalidDestination");
    }
  });

  it("rejects create_policy with the default public key as agent", async () => {
    try {
      // Unique id — 42 is used by the InvalidDestination case above.
      await createPolicyWithParams(
        new BN(142),
        defaultCreateParams({ agent: PublicKey.default })
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "InvalidAgent");
    }
  });

  it("rejects set_agent to the default public key", async () => {
    const id = new BN(43);
    const pda = await createPolicyWithParams(id, defaultCreateParams());
    try {
      await program.methods
        .setAgent(PublicKey.default)
        .accounts({ authority: authority.publicKey, policy: pda })
        .rpc();
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "InvalidAgent");
    }
  });

  // -------------------------------------------------------------------------
  // Rate limit
  // -------------------------------------------------------------------------

  it("rejects when rate limit is exceeded", async () => {
    const id = new BN(5);
    const pda = await createPolicyWithParams(
      id,
      defaultCreateParams({
        maxPerTransaction: oneUsdc(1),
        maxPerDay: oneUsdc(100),
        maxActionsPerWindow: 2,
        windowSeconds: 3600,
      })
    );
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(50));

    await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6);
    await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6);

    try {
      await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "RateLimitExceeded");
    }
  });

  // -------------------------------------------------------------------------
  // Pause / unpause
  // -------------------------------------------------------------------------

  it("pause blocks spends; unpause restores; outsider cannot pause", async () => {
    const id = new BN(6);
    const pda = await createPolicyWithParams(id, defaultCreateParams());
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(50));

    try {
      await program.methods
        .pausePolicy()
        .accounts({ authority: outsider.publicKey, policy: pda })
        .signers([outsider])
        .rpc();
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "UnauthorizedAuthority");
    }

    await program.methods
      .pausePolicy()
      .accounts({ authority: authority.publicKey, policy: pda })
      .rpc();

    try {
      await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "PolicyPaused");
    }

    await program.methods
      .unpausePolicy()
      .accounts({ authority: authority.publicKey, policy: pda })
      .rpc();

    await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6);
  });

  // -------------------------------------------------------------------------
  // Expiry
  // -------------------------------------------------------------------------

  it("rejects create with expires_at in the past", async () => {
    try {
      await createPolicyWithParams(
        new BN(7),
        defaultCreateParams({ expiresAt: new BN(1) })
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "InvalidExpiry");
    }
  });

  it("rejects spend after expiry", async () => {
    // Generous window so create+fund+first spend always fits; then wait until past expires_at.
    const expiresAt = Math.floor(Date.now() / 1000) + 12;
    const id = new BN(8);
    const pda = await createPolicyWithParams(
      id,
      defaultCreateParams({ expiresAt: new BN(expiresAt) })
    );
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(20));

    // Should work immediately
    await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6);

    const waitMs = Math.max(0, (expiresAt + 2) * 1000 - Date.now());
    await new Promise((r) => setTimeout(r, waitMs));

    try {
      await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "PolicyExpired");
    }
  });

  // -------------------------------------------------------------------------
  // Auth: agent / clawback / set_agent / update
  // -------------------------------------------------------------------------

  it("rejects execute_spend from non-agent", async () => {
    const id = new BN(9);
    const pda = await createPolicyWithParams(id, defaultCreateParams());
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(20));

    try {
      await executeSpend(
        pda,
        usdcMint,
        vault,
        outsiderUsdc,
        oneUsdc(1),
        JUPITER_V6,
        outsider
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "UnauthorizedAgent");
    }
  });

  it("authority can clawback while paused", async () => {
    const id = new BN(10);
    const pda = await createPolicyWithParams(id, defaultCreateParams());
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(30));

    await program.methods
      .pausePolicy()
      .accounts({ authority: authority.publicKey, policy: pda })
      .rpc();

    const before = await getAccount(connection, authorityUsdc);
    await program.methods
      .clawback(oneUsdc(30))
      .accounts({
        authority: authority.publicKey,
        policy: pda,
        mint: usdcMint,
        vaultToken: vault,
        destinationToken: authorityUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const vaultAfter = await getAccount(connection, vault);
    expect(Number(vaultAfter.amount)).to.equal(0);
    const after = await getAccount(connection, authorityUsdc);
    expect(Number(after.amount - before.amount)).to.equal(oneUsdc(30).toNumber());
  });

  it("set_agent rotates agent; old agent loses access", async () => {
    const id = new BN(11);
    const newAgent = Keypair.generate();
    await airdrop(newAgent.publicKey);

    const pda = await createPolicyWithParams(id, defaultCreateParams());
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(20));

    const newAgentUsdc = await createAta(usdcMint, newAgent.publicKey, authority);

    await program.methods
      .setAgent(newAgent.publicKey)
      .accounts({ authority: authority.publicKey, policy: pda })
      .rpc();

    try {
      await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(1), JUPITER_V6, agent);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "UnauthorizedAgent");
    }

    await executeSpend(
      pda,
      usdcMint,
      vault,
      newAgentUsdc,
      oneUsdc(1),
      JUPITER_V6,
      newAgent
    );
  });

  it("update_policy changes limits", async () => {
    const id = new BN(12);
    const pda = await createPolicyWithParams(id, defaultCreateParams());

    await program.methods
      .updatePolicy({
        expiresAt: new BN(0),
        maxPerTransaction: oneUsdc(5),
        maxPerDay: oneUsdc(10),
        maxActionsPerWindow: 3,
        windowSeconds: 120,
        programAllowlistEnabled: true,
        programAllowlist: [JUPITER_V6, DRIFT_PROGRAM],
        programDenylistEnabled: false,
        programDenylist: [],
        mintAllowlistEnabled: true,
        mintAllowlist: [usdcMint],
      } as any)
      .accounts({ authority: authority.publicKey, policy: pda })
      .rpc();

    const policy = await program.account.policy.fetch(pda);
    expect(policy.maxPerTransaction.toNumber()).to.equal(oneUsdc(5).toNumber());
    expect(policy.maxPerDay.toNumber()).to.equal(oneUsdc(10).toNumber());
    expect(policy.programAllowlist.length).to.equal(2);
  });

  it("rejects zero-amount spend", async () => {
    const id = new BN(13);
    const pda = await createPolicyWithParams(id, defaultCreateParams());
    const vault = getAssociatedTokenAddressSync(usdcMint, pda, true);
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          vault,
          pda,
          usdcMint
        )
      ),
      []
    );
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(10));

    try {
      await executeSpend(pda, usdcMint, vault, agentUsdc, new BN(0), JUPITER_V6);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "ZeroAmount");
    }
  });

  // -------------------------------------------------------------------------
  // Phase A — rejection matrix / authority edges
  // -------------------------------------------------------------------------

  async function ensureVault(pda: PublicKey, mint: PublicKey): Promise<PublicKey> {
    const vault = getAssociatedTokenAddressSync(mint, pda, true);
    const info = await connection.getAccountInfo(vault);
    if (!info) {
      await provider.sendAndConfirm(
        new anchor.web3.Transaction().add(
          createAssociatedTokenAccountInstruction(
            authority.publicKey,
            vault,
            pda,
            mint
          )
        ),
        []
      );
    }
    return vault;
  }

  it("rejects create with program list longer than max (ProgramListTooLong)", async () => {
    const eleven = Array.from({ length: 11 }, () => Keypair.generate().publicKey);
    try {
      await createPolicyWithParams(
        new BN(20),
        defaultCreateParams({
          programAllowlistEnabled: true,
          programAllowlist: eleven,
        })
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "ProgramListTooLong");
    }
  });

  it("rejects create with mint list longer than max (MintListTooLong)", async () => {
    const eleven = Array.from({ length: 11 }, () => Keypair.generate().publicKey);
    try {
      await createPolicyWithParams(
        new BN(21),
        defaultCreateParams({
          mintAllowlistEnabled: true,
          mintAllowlist: eleven,
        })
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "MintListTooLong");
    }
  });

  it("rejects create with empty mint allowlist when enabled (EmptyMintAllowlist)", async () => {
    try {
      await createPolicyWithParams(
        new BN(22),
        defaultCreateParams({
          mintAllowlistEnabled: true,
          mintAllowlist: [],
        })
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "EmptyMintAllowlist");
    }
  });

  it("rejects create with rate limit and window_seconds = 0 (InvalidRateWindow)", async () => {
    try {
      await createPolicyWithParams(
        new BN(23),
        defaultCreateParams({
          maxActionsPerWindow: 5,
          windowSeconds: 0,
        })
      );
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "InvalidRateWindow");
    }
  });

  it("rejects update_policy enabling empty program allowlist", async () => {
    const pda = await createPolicyWithParams(new BN(24), defaultCreateParams());
    try {
      await program.methods
        .updatePolicy({
          expiresAt: new BN(0),
          maxPerTransaction: oneUsdc(20),
          maxPerDay: oneUsdc(50),
          maxActionsPerWindow: 5,
          windowSeconds: 60,
          programAllowlistEnabled: true,
          programAllowlist: [],
          programDenylistEnabled: false,
          programDenylist: [],
          mintAllowlistEnabled: true,
          mintAllowlist: [usdcMint],
        } as any)
        .accounts({ authority: authority.publicKey, policy: pda })
        .rpc();
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "EmptyProgramAllowlist");
    }
  });

  it("rejects spend exceeding vault balance (InsufficientVaultBalance)", async () => {
    const pda = await createPolicyWithParams(
      new BN(25),
      defaultCreateParams({
        maxPerTransaction: oneUsdc(100),
        maxPerDay: oneUsdc(100),
      })
    );
    const vault = await ensureVault(pda, usdcMint);
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(5));

    try {
      await executeSpend(pda, usdcMint, vault, agentUsdc, oneUsdc(10), JUPITER_V6);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "InsufficientVaultBalance");
    }
  });

  it("rejects spend when vault authority is not the policy PDA", async () => {
    const pda = await createPolicyWithParams(new BN(26), defaultCreateParams());
    // Use agent-owned ATA as fake "vault" — wrong owner for policy.
    try {
      await executeSpend(pda, usdcMint, agentUsdc, agentUsdc, oneUsdc(1), JUPITER_V6);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "InvalidVaultAuthority");
    }
  });

  it("rejects spend when destination mint mismatches vault mint", async () => {
    const pda = await createPolicyWithParams(new BN(27), defaultCreateParams());
    const vault = await ensureVault(pda, usdcMint);
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(10));

    try {
      // agentOther is otherMint ATA; vault is usdcMint
      await executeSpend(pda, usdcMint, vault, agentOther, oneUsdc(1), JUPITER_V6);
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "MintMismatch");
    }
  });

  it("rejects outsider update_policy (UnauthorizedAuthority)", async () => {
    const pda = await createPolicyWithParams(new BN(28), defaultCreateParams());
    try {
      await program.methods
        .updatePolicy({
          expiresAt: new BN(0),
          maxPerTransaction: oneUsdc(1),
          maxPerDay: oneUsdc(1),
          maxActionsPerWindow: 1,
          windowSeconds: 60,
          programAllowlistEnabled: true,
          programAllowlist: [JUPITER_V6],
          programDenylistEnabled: false,
          programDenylist: [],
          mintAllowlistEnabled: true,
          mintAllowlist: [usdcMint],
        } as any)
        .accounts({ authority: outsider.publicKey, policy: pda })
        .signers([outsider])
        .rpc();
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "UnauthorizedAuthority");
    }
  });

  it("rejects outsider clawback (UnauthorizedAuthority)", async () => {
    const pda = await createPolicyWithParams(new BN(29), defaultCreateParams());
    const vault = await ensureVault(pda, usdcMint);
    await deposit(pda, usdcMint, authorityUsdc, vault, oneUsdc(10));
    const outsiderDest = outsiderUsdc;

    try {
      await program.methods
        .clawback(oneUsdc(1))
        .accounts({
          authority: outsider.publicKey,
          policy: pda,
          mint: usdcMint,
          vaultToken: vault,
          destinationToken: outsiderDest,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([outsider])
        .rpc();
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "UnauthorizedAuthority");
    }
  });

  it("rejects outsider set_agent (UnauthorizedAuthority)", async () => {
    const pda = await createPolicyWithParams(new BN(30), defaultCreateParams());
    try {
      await program.methods
        .setAgent(outsider.publicKey)
        .accounts({ authority: outsider.publicKey, policy: pda })
        .signers([outsider])
        .rpc();
      expect.fail("should have failed");
    } catch (e) {
      expectError(e, "UnauthorizedAuthority");
    }
  });

  it("allows outsider deposit into vault (open deposit model)", async () => {
    const pda = await createPolicyWithParams(new BN(31), defaultCreateParams());
    const vault = await ensureVault(pda, usdcMint);

    // Fund outsider with USDC
    await mintTo(usdcMint, outsiderUsdc, oneUsdc(50).toNumber());
    await deposit(pda, usdcMint, outsiderUsdc, vault, oneUsdc(15), outsider);

    const vaultAcc = await getAccount(connection, vault);
    expect(Number(vaultAcc.amount)).to.equal(oneUsdc(15).toNumber());
  });

  it("supports independent policies for the same authority (policy_id 2)", async () => {
    const pda1 = await createPolicyWithParams(new BN(32), defaultCreateParams());
    const pda2 = await createPolicyWithParams(new BN(33), defaultCreateParams());
    expect(pda1.equals(pda2)).to.equal(false);

    const vault1 = await ensureVault(pda1, usdcMint);
    const vault2 = await ensureVault(pda2, usdcMint);
    await deposit(pda1, usdcMint, authorityUsdc, vault1, oneUsdc(10));
    await deposit(pda2, usdcMint, authorityUsdc, vault2, oneUsdc(20));

    await executeSpend(pda1, usdcMint, vault1, agentUsdc, oneUsdc(1), JUPITER_V6);
    await executeSpend(pda2, usdcMint, vault2, agentUsdc, oneUsdc(2), JUPITER_V6);

    const p1 = await program.account.policy.fetch(pda1);
    const p2 = await program.account.policy.fetch(pda2);
    expect(p1.spentToday.toNumber()).to.equal(oneUsdc(1).toNumber());
    expect(p2.spentToday.toNumber()).to.equal(oneUsdc(2).toNumber());
    expect(p1.policyId.toNumber()).to.equal(32);
    expect(p2.policyId.toNumber()).to.equal(33);
  });
});
