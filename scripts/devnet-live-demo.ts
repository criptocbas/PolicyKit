/**
 * Phase C — live proof on Solana devnet.
 *
 * Creates mint + conservative policy, funds vault, succeeds one spend,
 * fails Drift intent + outsider destination. Writes proof JSON for the dashboard.
 *
 * Usage (from repo root):
 *   yarn build:packages
 *   yarn demo:devnet
 *
 * Env:
 *   RPC_URL          default https://api.devnet.solana.com
 *   AUTHORITY_KEY    path to authority keypair JSON (default ~/.config/solana/id.json)
 *   PROGRAM_ID       optional override
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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
  POLICYKIT_PROGRAM_ID,
  PolicyKitError,
  toPolicyKitError,
} from "@policykit/sdk";

const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.PROGRAM_ID
  ? new PublicKey(process.env.PROGRAM_ID)
  : POLICYKIT_PROGRAM_ID;

const DECIMALS = 6;
const ui = (n: number) => n * 10 ** DECIMALS;

function loadKeypair(filePath: string): Keypair {
  const resolved = filePath.startsWith("~")
    ? path.join(os.homedir(), filePath.slice(1))
    : filePath;
  const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function ensureAta(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  const info = await connection.getAccountInfo(ata);
  if (info) return ata;
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
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
  });
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
  const agent = Keypair.generate();
  const outsider = Keypair.generate();

  const connection = new Connection(RPC_URL, "confirmed");
  console.log("RPC", RPC_URL);
  console.log("Program", PROGRAM_ID.toBase58());
  console.log("Authority", authority.publicKey.toBase58());
  console.log("Agent (demo)", agent.publicKey.toBase58());

  const bal = await connection.getBalance(authority.publicKey);
  console.log("Authority balance SOL", bal / LAMPORTS_PER_SOL);
  if (bal < 0.5 * LAMPORTS_PER_SOL) {
    throw new Error("Authority needs ≥0.5 SOL on devnet for demo setup");
  }

  // Fund agent for fees
  {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: agent.publicKey,
        lamports: 0.05 * LAMPORTS_PER_SOL,
      })
    );
    await send(connection, tx, [authority]);
  }

  // Create demo mint
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
  console.log("Mint", mint.toBase58());

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

  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const sdk = new PolicyKitClient(provider, PROGRAM_ID);

  const policyId = Math.floor(Date.now() / 1000) % 1_000_000_000;
  const params = conservativeTradingTemplate({
    agent: agent.publicKey,
    spendMint: mint,
    decimals: DECIMALS,
  });

  const { policy, signature: createSig } = await sdk.createPolicy(
    policyId,
    params
  );
  console.log("Policy", policy.toBase58(), "create", createSig);

  const depositSig = await sdk.deposit({
    policy,
    mint,
    amount: ui(100),
  });
  console.log("Deposit", depositSig);

  const agentAta = await ensureAta(connection, authority, mint, agent.publicKey);
  const outsiderAta = await ensureAta(
    connection,
    authority,
    mint,
    outsider.publicKey
  );

  // Success spend
  let successSig: string | undefined;
  try {
    successSig = await sdk.executeSpend({
      policy,
      mint,
      amount: ui(5),
      intentProgram: KNOWN_PROGRAMS.JUPITER_V6,
      destination: agentAta,
      agent: agent.publicKey,
      signers: [agent],
    });
    console.log("SUCCESS spend", successSig);
  } catch (e) {
    console.error("Unexpected success-path failure", toPolicyKitError(e));
    throw e;
  }

  // Fail: Drift intent
  let driftError: { name: string; title: string } | undefined;
  try {
    await sdk.executeSpend({
      policy,
      mint,
      amount: ui(1),
      intentProgram: KNOWN_PROGRAMS.DRIFT,
      destination: agentAta,
      agent: agent.publicKey,
      signers: [agent],
    });
    throw new Error("Drift spend should have failed");
  } catch (e) {
    const err =
      e instanceof PolicyKitError ? e : toPolicyKitError(e);
    if (err.errorName === "Unknown" && String(e).includes("should have failed")) {
      throw e;
    }
    driftError = { name: err.errorName, title: err.title };
    console.log("EXPECTED FAIL Drift", driftError);
  }

  // Fail: outsider destination
  let destError: { name: string; title: string } | undefined;
  try {
    await sdk.executeSpend({
      policy,
      mint,
      amount: ui(1),
      intentProgram: KNOWN_PROGRAMS.JUPITER_V6,
      destination: outsiderAta,
      agent: agent.publicKey,
      signers: [agent],
    });
    throw new Error("Outsider dest should have failed");
  } catch (e) {
    const err =
      e instanceof PolicyKitError ? e : toPolicyKitError(e);
    if (
      err.errorName === "Unknown" &&
      String(e).includes("should have failed")
    ) {
      throw e;
    }
    destError = { name: err.errorName, title: err.title };
    console.log("EXPECTED FAIL destination", destError);
  }

  const status = await sdk.getPolicyStatus(policy);
  const proof = {
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
    signatures: {
      create: createSig,
      deposit: depositSig,
      successSpend: successSig,
    },
    rejections: {
      programNotAllowed: driftError,
      destinationNotAllowed: destError,
    },
    remainingDaily: status.remainingDaily?.toString() ?? null,
    spentToday: status.spentToday.toString(),
    explorer: {
      policy: `https://solscan.io/account/${policy.toBase58()}?cluster=devnet`,
      program: `https://solscan.io/account/${PROGRAM_ID.toBase58()}?cluster=devnet`,
      successTx: successSig
        ? `https://solscan.io/tx/${successSig}?cluster=devnet`
        : null,
    },
  };

  const outDir = path.join(__dirname, "..", "proof");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "devnet-latest.json");
  fs.writeFileSync(outFile, JSON.stringify(proof, null, 2));
  // Also copy into dashboard public for static serving
  const publicDir = path.join(
    __dirname,
    "..",
    "apps",
    "dashboard",
    "public",
    "proof"
  );
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(
    path.join(publicDir, "devnet-latest.json"),
    JSON.stringify(proof, null, 2)
  );

  console.log("\n=== Phase C proof written ===");
  console.log(outFile);
  console.log(JSON.stringify(proof.explorer, null, 2));
  console.log(
    "\nDashboard: set NEXT_PUBLIC_PROOF_URL=/proof/devnet-latest.json and load policy",
    proof.policy
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
