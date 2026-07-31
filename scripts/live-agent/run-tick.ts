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

async function main() {
  const cfg = loadLiveConfig();
  const authorityPath =
    process.env.AUTHORITY_KEY ?? "~/.config/solana/id.json";
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
  const canSpend =
    remaining === null || remaining.gten(ui(1));

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
        signature: sig,
        remainingDaily: st.remainingDaily?.toString() ?? null,
        message: "Allowed spend (Jupiter intent → agent ATA)",
        explorer: { tx: explorerTx(sig), policy: policyExplorer },
      });
      console.log("ALLOWED", sig);
    } catch (e) {
      const err =
        e instanceof PolicyKitError ? e : toPolicyKitError(e);
      if (
        err.errorName === "ExceedsDailyLimit" ||
        err.errorName === "ExceedsPerTransactionLimit" ||
        err.errorName === "RateLimitExceeded"
      ) {
        events.push({
          ts: new Date().toISOString(),
          kind: "reject_budget",
          ok: true,
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
    await withRetry(() =>
      sdk.executeSpend({
        policy,
        mint,
        amount: ui(1),
        intentProgram: KNOWN_PROGRAMS.DRIFT,
        destination: agentAta,
        agent: agent.publicKey,
        signers: [agent],
      })
    );
    events.push({
      ts: new Date().toISOString(),
      kind: "error",
      ok: false,
      message: "Drift intent should have failed",
      explorer: { policy: policyExplorer },
    });
  } catch (e) {
    const err =
      e instanceof PolicyKitError ? e : toPolicyKitError(e);
    const ok = err.errorName === "ProgramNotAllowed";
    events.push({
      ts: new Date().toISOString(),
      kind: "reject_program",
      ok,
      errorName: err.errorName,
      errorTitle: err.title,
      message: ok
        ? "Rogue program intent rejected (ProgramNotAllowed)"
        : `Expected ProgramNotAllowed got ${err.errorName}`,
      explorer: { policy: policyExplorer },
    });
    console.log(ok ? "REJECT PROGRAM ok" : "REJECT PROGRAM unexpected", err.errorName);
  }

  // 3) Rogue destination
  try {
    await withRetry(() =>
      sdk.executeSpend({
        policy,
        mint,
        amount: ui(1),
        intentProgram: KNOWN_PROGRAMS.JUPITER_V6,
        destination: outsiderAta,
        agent: agent.publicKey,
        signers: [agent],
      })
    );
    events.push({
      ts: new Date().toISOString(),
      kind: "error",
      ok: false,
      message: "Outsider dest should have failed",
      explorer: { policy: policyExplorer },
    });
  } catch (e) {
    const err =
      e instanceof PolicyKitError ? e : toPolicyKitError(e);
    const ok = err.errorName === "DestinationNotAllowed";
    events.push({
      ts: new Date().toISOString(),
      kind: "reject_dest",
      ok,
      errorName: err.errorName,
      errorTitle: err.title,
      message: ok
        ? "Rogue destination rejected (DestinationNotAllowed)"
        : `Expected DestinationNotAllowed got ${err.errorName}`,
      explorer: { policy: policyExplorer },
    });
    console.log(ok ? "REJECT DEST ok" : "REJECT DEST unexpected", err.errorName);
  }

  appendFeed(events);

  const failed = events.some((e) => !e.ok);
  if (failed) {
    console.error("Tick finished with unexpected failures");
    process.exit(1);
  }
  console.log("Tick OK —", events.length, "events written to proof/live-feed.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
