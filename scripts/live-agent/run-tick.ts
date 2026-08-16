/**
 * One tick of the compromised-agent demo (Phase D / edge C).
 *
 * 1) Allowed spend (Jupiter → agent ATA)
 * 2) Rogue program (Drift) → expect ProgramNotAllowed
 * 3) Rogue destination → expect DestinationNotAllowed
 *
 *   yarn agent:tick
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  PolicyKitClient,
  KNOWN_PROGRAMS,
  PolicyKitError,
  toPolicyKitError,
} from "@policykit/sdk";
import {
  AGENT_KEY_PATH,
  PROGRAM_ID,
  RPC_URL,
  TickEvent,
  appendFeed,
  explorerAccount,
  explorerTx,
  loadKeypair,
  loadLiveConfig,
  ui,
} from "./config";

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
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return ata;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String(e);
      if (msg.includes("429") || msg.includes("Too Many")) {
        await sleep(500 * Math.pow(2, i));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

async function submitExpectedRejection(
  connection: Connection,
  agent: Keypair,
  instruction: TransactionInstruction
): Promise<{
  signature: string;
  slot: number;
  blockTime: number | null;
  error: PolicyKitError;
}> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: agent.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(instruction);
  tx.sign(agent);

  // Expected failures must bypass RPC preflight to produce independently
  // verifiable failed transaction signatures.
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  if (!confirmation.value.err) {
    throw new Error(`Expected transaction ${signature} to fail on-chain`);
  }

  let transaction = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  for (let attempt = 0; !transaction && attempt < 5; attempt += 1) {
    await sleep(500 * 2 ** attempt);
    transaction = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  }
  if (!transaction) {
    throw new Error(
      `Failed transaction ${signature} was not available from RPC`
    );
  }

  return {
    signature,
    slot: transaction.slot,
    blockTime: transaction.blockTime ?? null,
    error: toPolicyKitError({ logs: transaction.meta?.logMessages ?? [] }),
  };
}

async function main() {
  const cfg = loadLiveConfig();
  const authorityPath = process.env.AUTHORITY_KEY ?? "~/.config/solana/id.json";
  // Fee payer for ATA creation only; spends signed by agent
  const authority = loadKeypair(authorityPath);
  const agent = loadKeypair(AGENT_KEY_PATH);
  const connection = new Connection(RPC_URL, "confirmed");
  const policy = new PublicKey(cfg.policy);
  const mint = new PublicKey(cfg.spendMint);

  if (agent.publicKey.toBase58() !== cfg.agent) {
    console.warn(
      "Warning: agent key pubkey does not match live-config agent field"
    );
  }

  const provider = new AnchorProvider(connection, new Wallet(authority), {
    commitment: "confirmed",
  });
  const sdk = new PolicyKitClient(provider, PROGRAM_ID);

  const status = await withRetry(() => sdk.getPolicyStatus(policy));
  const remaining = status.remainingDaily;
  const events: TickEvent[] = [];
  const policyExplorer = explorerAccount(cfg.policy);

  console.log("Policy", cfg.policy);
  console.log(
    "Remaining daily",
    remaining === null ? "unlimited" : remaining.toString()
  );

  // Skip allowed spend if daily budget too low (still run rejects)
  const canSpend = remaining === null || remaining.gten(ui(1));

  const agentAta = await withRetry(() =>
    ensureAta(connection, authority, mint, agent.publicKey)
  );
  const outsider = Keypair.generate();
  const outsiderAta = await withRetry(() =>
    ensureAta(connection, authority, mint, outsider.publicKey)
  );

  // 1) Allowed
  if (!canSpend) {
    events.push({
      ts: new Date().toISOString(),
      kind: "skip_budget",
      ok: true,
      evidence: "local_observation",
      message: "Daily budget exhausted — economic bound holding (C success)",
      remainingDaily: remaining?.toString() ?? null,
      explorer: { policy: policyExplorer },
    });
    console.log("SKIP allowed spend — daily budget exhausted (C ok)");
  } else if (status.isPaused) {
    events.push({
      ts: new Date().toISOString(),
      kind: "skip_budget",
      ok: true,
      evidence: "local_observation",
      message: "Policy paused — circuit breaker active",
      remainingDaily: remaining?.toString() ?? null,
      explorer: { policy: policyExplorer },
    });
    console.log("SKIP — policy paused");
  } else {
    try {
      const sig = await withRetry(() =>
        sdk.executeSpend({
          policy,
          mint,
          amount: ui(1),
          intentProgram: KNOWN_PROGRAMS.JUPITER_V6,
          destination: agentAta,
          agent: agent.publicKey,
          signers: [agent],
        })
      );
      const st = await sdk.getPolicyStatus(policy);
      events.push({
        ts: new Date().toISOString(),
        kind: "allowed",
        ok: true,
        evidence: "onchain_success",
        signature: sig,
        remainingDaily: st.remainingDaily?.toString() ?? null,
        message: "Allowed spend (Jupiter intent → agent ATA)",
        explorer: { tx: explorerTx(sig), policy: policyExplorer },
      });
      console.log("ALLOWED", sig);
    } catch (e) {
      const err = e instanceof PolicyKitError ? e : toPolicyKitError(e);
      if (
        err.errorName === "ExceedsDailyLimit" ||
        err.errorName === "ExceedsPerTransactionLimit" ||
        err.errorName === "RateLimitExceeded"
      ) {
        events.push({
          ts: new Date().toISOString(),
          kind: "reject_budget",
          ok: true,
          evidence: "preflight_rejection",
          errorName: err.errorName,
          errorTitle: err.title,
          message: "Spend blocked by budget/rate — bound holding",
          remainingDaily: remaining?.toString() ?? null,
          explorer: { policy: policyExplorer },
        });
        console.log("BUDGET BOUND", err.errorName);
      } else {
        events.push({
          ts: new Date().toISOString(),
          kind: "error",
          ok: false,
          evidence: "local_observation",
          errorName: err.errorName,
          message: err.message,
          explorer: { policy: policyExplorer },
        });
        console.error("UNEXPECTED allowed-path error", err);
      }
    }
  }

  // 2) Rogue program
  try {
    const instruction = await sdk.buildExecuteSpendIx({
      policy,
      mint,
      amount: ui(1),
      intentProgram: KNOWN_PROGRAMS.DRIFT,
      destination: agentAta,
      agent: agent.publicKey,
    });
    const result = await withRetry(() =>
      submitExpectedRejection(connection, agent, instruction)
    );
    const ok = result.error.errorName === "ProgramNotAllowed";
    events.push({
      ts: new Date().toISOString(),
      kind: "reject_program",
      ok,
      evidence: "onchain_rejection",
      errorName: result.error.errorName,
      errorTitle: result.error.title,
      signature: result.signature,
      slot: result.slot,
      blockTime: result.blockTime,
      message: ok
        ? "Rogue program intent rejected on-chain (ProgramNotAllowed)"
        : `Expected ProgramNotAllowed got ${result.error.errorName}`,
      explorer: {
        tx: explorerTx(result.signature),
        policy: policyExplorer,
      },
    });
    console.log(
      ok ? "REJECT PROGRAM on-chain ok" : "REJECT PROGRAM unexpected",
      result.error.errorName,
      result.signature
    );
  } catch (e) {
    const err = e instanceof PolicyKitError ? e : toPolicyKitError(e);
    events.push({
      ts: new Date().toISOString(),
      kind: "error",
      ok: false,
      evidence: "local_observation",
      errorName: err.errorName,
      errorTitle: err.title,
      message: `Could not publish on-chain program rejection: ${err.message}`,
      explorer: { policy: policyExplorer },
    });
    console.error("REJECT PROGRAM submission failed", e);
  }

  // 3) Rogue destination
  try {
    const instruction = await sdk.buildExecuteSpendIx({
      policy,
      mint,
      amount: ui(1),
      intentProgram: KNOWN_PROGRAMS.JUPITER_V6,
      destination: outsiderAta,
      agent: agent.publicKey,
    });
    const result = await withRetry(() =>
      submitExpectedRejection(connection, agent, instruction)
    );
    const ok = result.error.errorName === "DestinationNotAllowed";
    events.push({
      ts: new Date().toISOString(),
      kind: "reject_dest",
      ok,
      evidence: "onchain_rejection",
      errorName: result.error.errorName,
      errorTitle: result.error.title,
      signature: result.signature,
      slot: result.slot,
      blockTime: result.blockTime,
      message: ok
        ? "Rogue destination rejected on-chain (DestinationNotAllowed)"
        : `Expected DestinationNotAllowed got ${result.error.errorName}`,
      explorer: {
        tx: explorerTx(result.signature),
        policy: policyExplorer,
      },
    });
    console.log(
      ok ? "REJECT DEST on-chain ok" : "REJECT DEST unexpected",
      result.error.errorName,
      result.signature
    );
  } catch (e) {
    const err = e instanceof PolicyKitError ? e : toPolicyKitError(e);
    events.push({
      ts: new Date().toISOString(),
      kind: "error",
      ok: false,
      evidence: "local_observation",
      errorName: err.errorName,
      errorTitle: err.title,
      message: `Could not publish on-chain destination rejection: ${err.message}`,
      explorer: { policy: policyExplorer },
    });
    console.error("REJECT DEST submission failed", e);
  }

  appendFeed(events, {
    cluster: cfg.cluster,
    policy: cfg.policy,
    programId: cfg.programId,
  });

  const failed = events.some((e) => !e.ok);
  if (failed) {
    console.error("Tick finished with unexpected failures");
    process.exit(1);
  }
  console.log(
    "Tick OK —",
    events.length,
    "events this run · feed written to proof/live-feed.json + apps/dashboard/public/proof/"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
