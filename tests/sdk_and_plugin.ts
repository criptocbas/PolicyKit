/**
 * Phase 2 integration tests: PolicyKit TypeScript SDK + Agent Kit plugin methods.
 *
 * Demo narrative:
 *  1. Human creates conservative trading policy (Jupiter-only allowlist, tight limits)
 *  2. Fund vault
 *  3. Agent succeeds several spends with Jupiter intent
 *  4. Clean on-chain rejections for forbidden program, limits, wrong agent, pause, etc.
 */
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
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

import {
  PolicyKitClient,
  PolicyKitError,
  conservativeTradingTemplate,
  KNOWN_PROGRAMS,
  findPolicyPda,
  findVaultAta,
  previewSpend,
  mapPolicyKitError,
} from "../packages/sdk/src";
import { createPolicyKitMethods } from "../packages/agent-kit-plugin/src/methods";
import { resolveConfig } from "../packages/agent-kit-plugin/src/config";

const JUPITER = KNOWN_PROGRAMS.JUPITER_V6;
const DRIFT = KNOWN_PROGRAMS.DRIFT;
const FORBIDDEN = new PublicKey("11111111111111111111111111111112");

describe("PolicyKit SDK + Agent Kit plugin", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const authority = (provider.wallet as anchor.Wallet).payer;
  const agent = Keypair.generate();
  const outsider = Keypair.generate();

  let sdk: PolicyKitClient;
  let usdcMint: PublicKey;
  let authorityUsdc: PublicKey;
  let agentUsdc: PublicKey;
  let outsiderUsdc: PublicKey;

  const DECIMALS = 6;
  const ui = (n: number) => new BN(n * 10 ** DECIMALS);

  let policyCounter = 100;

  async function airdrop(pk: PublicKey, sol = 2) {
    const sig = await connection.requestAirdrop(pk, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }

  async function createMint(): Promise<PublicKey> {
    const mint = Keypair.generate();
    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        mint.publicKey,
        DECIMALS,
        authority.publicKey,
        null
      )
    );
    await provider.sendAndConfirm(tx, [mint]);
    return mint.publicKey;
  }

  async function ensureAta(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    const ata = getAssociatedTokenAddressSync(mint, owner, true);
    if (await connection.getAccountInfo(ata)) return ata;
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          ata,
          owner,
          mint
        )
      ),
      []
    );
    return ata;
  }

  async function mintTo(dest: PublicKey, amount: number) {
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createMintToInstruction(usdcMint, dest, authority.publicKey, amount)
      ),
      []
    );
  }

  /** Create conservative policy, fund vault, return addresses. */
  async function setupConservativePolicy(overrides: Record<string, unknown> = {}) {
    const policyId = new BN(policyCounter++);
    const params = {
      ...conservativeTradingTemplate({
        agent: agent.publicKey,
        spendMint: usdcMint,
        decimals: DECIMALS,
      }),
      // Tighter for tests
      maxPerTransaction: ui(20),
      maxPerDay: ui(50),
      maxActionsPerWindow: 5,
      windowSeconds: 60,
      programDenylistEnabled: true,
      programDenylist: [FORBIDDEN],
      ...overrides,
    };

    const { policy } = await sdk.createPolicy(policyId, params as any);
    await sdk.deposit({ policy, mint: usdcMint, amount: ui(200) });
    return { policy, policyId };
  }

  async function agentSpend(
    policy: PublicKey,
    amount: BN,
    intent: PublicKey = JUPITER,
    dest: PublicKey = agentUsdc,
    signer: Keypair = agent
  ) {
    return sdk.executeSpend({
      policy,
      mint: usdcMint,
      amount,
      intentProgram: intent,
      destination: dest,
      agent: signer.publicKey,
      signers: [signer],
    });
  }

  before(async () => {
    await airdrop(agent.publicKey);
    await airdrop(outsider.publicKey);
    usdcMint = await createMint();
    authorityUsdc = await ensureAta(usdcMint, authority.publicKey);
    agentUsdc = await ensureAta(usdcMint, agent.publicKey);
    outsiderUsdc = await ensureAta(usdcMint, outsider.publicKey);
    await mintTo(authorityUsdc, 10_000_000_000);

    // Program id from workspace (matches deployed local validator binary)
    const workspaceProgram = anchor.workspace.policykit as anchor.Program;
    sdk = new PolicyKitClient(provider, workspaceProgram.programId);
  });

  // -------------------------------------------------------------------------
  // Demo narrative: success path
  // -------------------------------------------------------------------------

  it("demo: create conservative policy, fund, agent spends successfully under Jupiter intent", async () => {
    const { policy, policyId } = await setupConservativePolicy();

    // PDA helpers match on-chain
    const [derived] = findPolicyPda(
      authority.publicKey,
      policyId,
      sdk.programId
    );
    expect(derived.toBase58()).to.equal(policy.toBase58());
    const onchain = await sdk.getPolicy(policy);
    expect(onchain.agent.toBase58()).to.equal(agent.publicKey.toBase58());
    expect(onchain.programAllowlistEnabled).to.equal(true);

    const sig1 = await agentSpend(policy, ui(10), JUPITER);
    expect(sig1).to.be.a("string");

    const sig2 = await agentSpend(policy, ui(15), JUPITER);
    expect(sig2).to.be.a("string");

    const status = await sdk.getPolicyStatus(policy);
    expect(status.isActive).to.equal(true);
    expect(status.spentToday.toNumber()).to.equal(ui(25).toNumber());
    expect(status.remainingDaily!.toNumber()).to.equal(ui(25).toNumber());
    expect(status.remainingActions).to.equal(3); // 5 - 2

    const agentBal = await getAccount(connection, agentUsdc);
    expect(Number(agentBal.amount)).to.be.gte(ui(25).toNumber());
  });

  // -------------------------------------------------------------------------
  // Failure paths (demo-visible)
  // -------------------------------------------------------------------------

  it("fails cleanly: ProgramNotAllowed (Drift not on allowlist)", async () => {
    const { policy } = await setupConservativePolicy();
    try {
      await agentSpend(policy, ui(1), DRIFT);
      expect.fail("should reject");
    } catch (e) {
      expect(e).to.be.instanceOf(PolicyKitError);
      const err = e as PolicyKitError;
      expect(err.errorName).to.equal("ProgramNotAllowed");
      expect(err.isPolicyRejection).to.equal(true);
      expect(err.title).to.equal("Program not allowed");
      expect(err.message).to.include("allowlist");
    }
  });

  it("fails cleanly: ProgramDenied", async () => {
    const { policy } = await setupConservativePolicy({
      programAllowlistEnabled: false,
      programAllowlist: [],
      programDenylistEnabled: true,
      programDenylist: [FORBIDDEN],
    });
    try {
      await agentSpend(policy, ui(1), FORBIDDEN);
      expect.fail("should reject");
    } catch (e) {
      expect((e as PolicyKitError).errorName).to.equal("ProgramDenied");
    }
  });

  it("fails cleanly: ExceedsPerTransactionLimit", async () => {
    const { policy } = await setupConservativePolicy();
    try {
      await agentSpend(policy, ui(25)); // max 20
      expect.fail("should reject");
    } catch (e) {
      expect((e as PolicyKitError).errorName).to.equal(
        "ExceedsPerTransactionLimit"
      );
    }
  });

  it("fails cleanly: ExceedsDailyLimit", async () => {
    const { policy } = await setupConservativePolicy({
      maxPerTransaction: ui(30),
      maxPerDay: ui(40),
    });
    await agentSpend(policy, ui(30));
    try {
      await agentSpend(policy, ui(20)); // 30+20 > 40
      expect.fail("should reject");
    } catch (e) {
      expect((e as PolicyKitError).errorName).to.equal("ExceedsDailyLimit");
      const mapped = mapPolicyKitError(e);
      expect(mapped.title).to.equal("Over daily budget");
    }
  });

  it("fails cleanly: RateLimitExceeded", async () => {
    const { policy } = await setupConservativePolicy({
      maxPerTransaction: ui(1),
      maxPerDay: ui(100),
      maxActionsPerWindow: 2,
      windowSeconds: 3600,
    });
    await agentSpend(policy, ui(1));
    await agentSpend(policy, ui(1));
    try {
      await agentSpend(policy, ui(1));
      expect.fail("should reject");
    } catch (e) {
      expect((e as PolicyKitError).errorName).to.equal("RateLimitExceeded");
    }
  });

  it("fails cleanly: UnauthorizedAgent", async () => {
    const { policy } = await setupConservativePolicy();
    try {
      await agentSpend(policy, ui(1), JUPITER, outsiderUsdc, outsider);
      expect.fail("should reject");
    } catch (e) {
      expect((e as PolicyKitError).errorName).to.equal("UnauthorizedAgent");
    }
  });

  it("fails cleanly: PolicyPaused", async () => {
    const { policy } = await setupConservativePolicy();
    await sdk.pausePolicy(policy);
    try {
      await agentSpend(policy, ui(1));
      expect.fail("should reject");
    } catch (e) {
      expect((e as PolicyKitError).errorName).to.equal("PolicyPaused");
    }
    await sdk.unpausePolicy(policy);
    await agentSpend(policy, ui(1)); // recovers
  });

  it("fails cleanly: ZeroAmount", async () => {
    const { policy } = await setupConservativePolicy();
    try {
      await agentSpend(policy, new BN(0));
      expect.fail("should reject");
    } catch (e) {
      expect((e as PolicyKitError).errorName).to.equal("ZeroAmount");
    }
  });

  it("fails cleanly: PolicyExpired", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { policy } = await setupConservativePolicy({
      expiresAt: now + 3,
    });
    await agentSpend(policy, ui(1));
    await new Promise((r) => setTimeout(r, 4000));
    try {
      await agentSpend(policy, ui(1));
      expect.fail("should reject");
    } catch (e) {
      expect((e as PolicyKitError).errorName).to.equal("PolicyExpired");
    }
  });

  // -------------------------------------------------------------------------
  // Helpers: preview + remaining budget
  // -------------------------------------------------------------------------

  it("previewSpend catches limit breaches client-side before tx", async () => {
    const { policy } = await setupConservativePolicy();
    const data = await sdk.getPolicy(policy);
    const bad = previewSpend(data, {
      amount: ui(100),
      mint: usdcMint,
      intentProgram: JUPITER,
    });
    expect(bad.ok).to.equal(false);
    if (!bad.ok) {
      expect(bad.errorName).to.equal("ExceedsPerTransactionLimit");
    }
    const good = previewSpend(data, {
      amount: ui(5),
      mint: usdcMint,
      intentProgram: JUPITER,
    });
    expect(good.ok).to.equal(true);
  });

  it("vault ATA helper matches deposit target", async () => {
    const { policy } = await setupConservativePolicy();
    const vault = findVaultAta(policy, usdcMint);
    const bal = await sdk.getVaultBalance(policy, usdcMint);
    expect(bal.toNumber()).to.equal(ui(200).toNumber());
    const acc = await getAccount(connection, vault);
    expect(Number(acc.amount)).to.equal(ui(200).toNumber());
  });

  // -------------------------------------------------------------------------
  // Agent Kit plugin methods (without full SolanaAgentKit network stack)
  // -------------------------------------------------------------------------

  it("plugin methods: executeSpendUnderPolicy success + ProgramNotAllowed", async () => {
    const { policy } = await setupConservativePolicy();

    // Minimal agent stub matching what methods() needs
    const agentWallet = {
      publicKey: agent.publicKey,
      payer: agent,
      signTransaction: async (tx: any) => {
        tx.partialSign(agent);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        txs.forEach((t) => t.partialSign(agent));
        return txs;
      },
    };

    // Use a provider whose wallet is the agent for plugin client
    const agentProvider = new anchor.AnchorProvider(
      connection,
      agentWallet as any,
      { commitment: "confirmed" }
    );

    const fakeAgent = {
      connection,
      wallet: agentWallet,
      config: {},
    } as any;

    const cfg = resolveConfig({
      policy,
      programId: sdk.programId,
      defaultMint: usdcMint,
      defaultIntentProgram: JUPITER,
      clientSidePreflight: false, // force on-chain errors for forbidden path
    });

    // Monkey-patch: methods build client from agent; we need agent provider fee payer.
    // Anchor Wallet needs to pay fees — airdrop already done. Use agent as fee payer.
    const methods = createPolicyKitMethods(
      () => fakeAgent,
      () => cfg
    );

    // Override getPolicyKitClient path by ensuring execute uses agent-signed txs.
    // PolicyKitClient.fromConnection with agent wallet:
    const agentSdk = new PolicyKitClient(agentProvider, sdk.programId);

    // Success via SDK (agent wallet)
    const sig = await agentSdk.executeSpend({
      policy,
      mint: usdcMint,
      amount: ui(5),
      intentProgram: JUPITER,
      destination: agentUsdc,
    });
    expect(sig).to.be.a("string");

    // Plugin checkSpend preflight
    const checkOk = await methods.checkSpend({
      amount: ui(5).toString(),
      intentProgram: JUPITER.toBase58(),
    });
    expect(checkOk.ok).to.equal(true);

    const checkBad = await methods.checkSpend({
      amount: ui(5).toString(),
      intentProgram: DRIFT.toBase58(),
    });
    expect(checkBad.ok).to.equal(false);
    expect(checkBad.errorName).to.equal("ProgramNotAllowed");

    // Plugin executeSpendUnderPolicy — needs client with agent wallet.
    // Re-bind methods to use agentSdk by calling execute through agentSdk path:
    // executeSpendUnderPolicy builds its own client from agent.wallet — fee payer is agent.
    const resultOk = await methods.executeSpendUnderPolicy({
      amount: ui(5).toString(),
      destination: agent.publicKey.toBase58(),
      destinationToken: agentUsdc.toBase58(),
      intentProgram: JUPITER.toBase58(),
    });
    expect(resultOk.status).to.equal("success");
    expect(resultOk.signature).to.be.a("string");
    expect(resultOk.remainingDaily).to.be.a("string");

    const resultBad = await methods.executeSpendUnderPolicy({
      amount: ui(1).toString(),
      destinationToken: agentUsdc.toBase58(),
      intentProgram: DRIFT.toBase58(),
    });
    expect(resultBad.status).to.equal("error");
    expect(resultBad.errorName).to.equal("ProgramNotAllowed");
    expect(resultBad.message).to.include("allowlist");
  });

  it("plugin getPolicyStatus surfaces remaining budget", async () => {
    const { policy } = await setupConservativePolicy();
    await agentSpend(policy, ui(10));

    const agentWallet = {
      publicKey: agent.publicKey,
      payer: agent,
      signTransaction: async (tx: any) => {
        tx.partialSign(agent);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        txs.forEach((t) => t.partialSign(agent));
        return txs;
      },
    };
    const fakeAgent = {
      connection,
      wallet: agentWallet,
      config: {},
    } as any;

    const methods = createPolicyKitMethods(
      () => fakeAgent,
      () =>
        resolveConfig({
          policy,
          programId: sdk.programId,
          defaultMint: usdcMint,
          defaultIntentProgram: JUPITER,
        })
    );

    const status = await methods.getPolicyStatus();
    expect(status.formatted.isActive).to.equal(true);
    expect(status.formatted.spentToday).to.equal(ui(10).toString());
    expect(Number(status.formatted.remainingDaily as string)).to.equal(
      ui(40).toNumber()
    );
  });

  it("setAgent rotates access via SDK", async () => {
    const { policy } = await setupConservativePolicy();
    const newAgent = Keypair.generate();
    await airdrop(newAgent.publicKey);
    const newAgentUsdc = await ensureAta(usdcMint, newAgent.publicKey);

    await sdk.setAgent(policy, newAgent.publicKey);

    try {
      await agentSpend(policy, ui(1), JUPITER, agentUsdc, agent);
      expect.fail("old agent should fail");
    } catch (e) {
      expect((e as PolicyKitError).errorName).to.equal("UnauthorizedAgent");
    }

    await agentSpend(policy, ui(1), JUPITER, newAgentUsdc, newAgent);
  });
});
