/**
 * One-time setup for the always-on adversary demo (Phase D / edge C).
 *
 * Creates a dedicated agent keypair (gitignored), mint, strict policy,
 * funds vault. Writes proof/live-config.json (public addresses only).
 *
 *   yarn agent:setup
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  PolicyKitClient,
  conservativeTradingTemplate,
  KNOWN_PROGRAMS,
} from "@policykit/sdk";
import {
  AGENT_KEY_PATH,
  DECIMALS,
  PROGRAM_ID,
  RPC_URL,
  explorerAccount,
  loadKeypair,
  saveKeypair,
  ui,
  writeLiveConfig,
} from "./config";
import * as fs from "fs";

async function ensureAta(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  if (await connection.getAccountInfo(ata)) return ata;
  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );
  await send(connection, tx, [payer]);
  return ata;
}

async function send(
  connection: Connection,
  tx: Transaction,
  signers: Keypair[]
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = signers[0].publicKey;
  tx.sign(...signers);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return sig;
}

async function main() {
  const authorityPath =
    process.env.AUTHORITY_KEY ?? "~/.config/solana/id.json";
  const authority = loadKeypair(authorityPath);
  const connection = new Connection(RPC_URL, "confirmed");

  console.log("RPC", RPC_URL);
  console.log("Program", PROGRAM_ID.toBase58());
  console.log("Authority", authority.publicKey.toBase58());

  const bal = await connection.getBalance(authority.publicKey);
  console.log("Balance SOL", bal / LAMPORTS_PER_SOL);
  if (bal < 0.3 * LAMPORTS_PER_SOL) {
    throw new Error("Need ≥0.3 SOL on authority for live-agent setup");
  }

  // Dedicated agent key (devnet-only; gitignored)
  let agent: Keypair;
  if (fs.existsSync(AGENT_KEY_PATH)) {
    agent = loadKeypair(AGENT_KEY_PATH);
    console.log("Reusing agent key", agent.publicKey.toBase58());
  } else {
    agent = Keypair.generate();
    saveKeypair(AGENT_KEY_PATH, agent);
    console.log("Created agent key →", AGENT_KEY_PATH);
  }

  // Fee SOL for agent
  await send(
    connection,
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: agent.publicKey,
        lamports: Math.floor(0.05 * LAMPORTS_PER_SOL),
      })
    ),
    [authority]
  );

  // Mint
  const mintKp = Keypair.generate();
  const mint = mintKp.publicKey;
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  await send(
    connection,
    new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mint,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        mint,
        DECIMALS,
        authority.publicKey,
        null,
        TOKEN_PROGRAM_ID
      )
    ),
    [authority, mintKp]
  );

  const authorityAta = await ensureAta(
    connection,
    authority,
    mint,
    authority.publicKey
  );
  await send(
    connection,
    new Transaction().add(
      createMintToInstruction(
        mint,
        authorityAta,
        authority.publicKey,
        ui(1_000_000),
        [],
        TOKEN_PROGRAM_ID
      )
    ),
    [authority]
  );

  await ensureAta(connection, authority, mint, agent.publicKey);

  const provider = new AnchorProvider(connection, new Wallet(authority), {
    commitment: "confirmed",
  });
  const sdk = new PolicyKitClient(provider, PROGRAM_ID);

  // Strict adversary-demo policy: small budgets, Jupiter + agent dest only
  const policyId = Math.floor(Date.now() / 1000) % 1_000_000_000;
  const base = conservativeTradingTemplate({
    agent: agent.publicKey,
    spendMint: mint,
    decimals: DECIMALS,
  });
  const params = {
    ...base,
    maxPerTransaction: ui(5),
    maxPerDay: ui(50),
    maxActionsPerWindow: 20,
    windowSeconds: 60,
    programAllowlistEnabled: true,
    programAllowlist: [KNOWN_PROGRAMS.JUPITER_V6],
    destinationAllowlistEnabled: true,
    destinationAllowlist: [agent.publicKey],
  };

  const { policy } = await sdk.createPolicy(policyId, params);
  await sdk.deposit({ policy, mint, amount: ui(200) });

  const cfg = {
    cluster: "devnet",
    rpcUrl: RPC_URL.includes("api-key")
      ? "https://api.devnet.solana.com"
      : RPC_URL,
    programId: PROGRAM_ID.toBase58(),
    policy: policy.toBase58(),
    policyId,
    spendMint: mint.toBase58(),
    agent: agent.publicKey.toBase58(),
    authority: authority.publicKey.toBase58(),
    createdAt: new Date().toISOString(),
    explorer: {
      policy: explorerAccount(policy.toBase58()),
      program: explorerAccount(PROGRAM_ID.toBase58()),
    },
  };
  writeLiveConfig(cfg);

  console.log("\n=== Live policy ready ===");
  console.log(JSON.stringify(cfg, null, 2));
  console.log("\nPublic page (after dashboard deploy): /p/" + policy.toBase58());
  console.log("Run ticks: yarn agent:tick");
  console.log("Agent secret (gitignored):", AGENT_KEY_PATH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
