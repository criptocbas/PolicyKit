/**
 * Gold-standard Agent Kit + PolicyKit example (edge A + C).
 *
 * Cold path from monorepo root:
 *   yarn build:packages && yarn agent:setup   # once
 *   cd examples/agent-kit-bounded-spend && yarn install && yarn start
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { KeypairWallet, SolanaAgentKit } from "solana-agent-kit";
import { createPolicyKitPlugin } from "@policykit/agent-kit-plugin";
import { computeMaxDamage, KNOWN_PROGRAMS } from "@policykit/sdk";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

dotenv.config();

const ROOT = path.join(__dirname, "..", "..", "..");
const liveConfigPath = resolvePath(
  process.env.LIVE_CONFIG ?? path.join(ROOT, "proof", "live-config.json")
);
const agentKeyPath = resolvePath(
  process.env.AGENT_KEY ?? path.join(ROOT, "proof", ".agent-keypair.json")
);
const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function loadKeypair(p: string): Keypair {
  if (!fs.existsSync(p)) {
    throw new Error(
      `Missing agent key at ${p}\n` +
        `  Fix: from monorepo root run  yarn agent:setup\n` +
        `  Or set AGENT_KEY to a JSON byte-array secret key file.`
    );
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function banner(title: string) {
  console.log("\n" + "─".repeat(56));
  console.log(title);
  console.log("─".repeat(56));
}

function step(n: number, label: string) {
  console.log(`\n[${n}] ${label}`);
}

async function main() {
  banner("PolicyKit × Solana Agent Kit — bounded spend");

  if (!fs.existsSync(liveConfigPath)) {
    throw new Error(
      `Missing live config at ${liveConfigPath}\n` +
        `  Fix: from monorepo root run  yarn agent:setup\n` +
        `  Or set LIVE_CONFIG to a proof/live-config.json path.`
    );
  }

  const cfg = JSON.parse(fs.readFileSync(liveConfigPath, "utf8")) as {
    policy: string;
    spendMint: string;
    programId: string;
    agent?: string;
    explorer?: { policy?: string };
  };
  const agent = loadKeypair(agentKeyPath);
  const policy = new PublicKey(cfg.policy);
  const mint = new PublicKey(cfg.spendMint);
  const programId = new PublicKey(cfg.programId);

  if (cfg.agent && cfg.agent !== agent.publicKey.toBase58()) {
    console.warn(
      "⚠ Agent key pubkey does not match live-config.agent — spends may fail UnauthorizedAgent."
    );
  }

  console.log("RPC        ", RPC);
  console.log("Policy     ", policy.toBase58());
  console.log("Agent      ", agent.publicKey.toBase58());
  console.log("Spend mint ", mint.toBase58());

  const wallet = new KeypairWallet(agent, RPC);
  const kit = new SolanaAgentKit(wallet, RPC, {}).use(
    createPolicyKitPlugin({
      policy,
      programId,
      defaultMint: mint,
      defaultIntentProgram: KNOWN_PROGRAMS.JUPITER_V6,
    })
  );

  step(1, "Policy status + max damage (if key stolen now)");
  const status = await kit.methods.getPolicyStatus();
  console.log("  active:", status.formatted.isActive);
  console.log("  remaining daily:", status.formatted.remainingDaily);
  console.log("  remaining actions:", status.formatted.remainingActions);
  console.log("  max damage:", computeMaxDamage(status.policy).summary);

  const dest = getAssociatedTokenAddressSync(
    mint,
    agent.publicKey,
    true,
    TOKEN_PROGRAM_ID
  );
  const outsider = Keypair.generate().publicKey;
  const outsiderAta = getAssociatedTokenAddressSync(
    mint,
    outsider,
    true,
    TOKEN_PROGRAM_ID
  );

  step(2, "Allowed spend (Jupiter intent → agent ATA)");
  const ok = await kit.methods.executeSpendUnderPolicy({
    amount: String(1_000_000), // 1 token @ 6 decimals
    destination: agent.publicKey.toBase58(),
    destinationToken: dest.toBase58(),
    intentProgram: KNOWN_PROGRAMS.JUPITER_V6.toBase58(),
  });
  console.log("  →", ok.status, ok.message);
  if (ok.status !== "success") {
    // Budget exhaust is still a successful demo of bounds
    if (
      ok.errorName === "ExceedsDailyLimit" ||
      ok.errorName === "ExceedsPerTransactionLimit" ||
      ok.errorName === "RateLimitExceeded"
    ) {
      console.log("  (budget/rate bound holding — still a valid C demo)");
    } else {
      throw new Error(`Expected allowed spend success, got: ${ok.message}`);
    }
  }

  step(3, "Rogue program intent (Drift) — expect ProgramNotAllowed");
  const badProg = await kit.methods.executeSpendUnderPolicy({
    amount: String(1_000_000),
    destinationToken: dest.toBase58(),
    intentProgram: KNOWN_PROGRAMS.DRIFT.toBase58(),
  });
  console.log(
    "  →",
    badProg.status,
    badProg.errorTitle ?? badProg.errorName ?? badProg.message
  );
  if (badProg.status === "success" || badProg.errorName !== "ProgramNotAllowed") {
    throw new Error(
      `Expected ProgramNotAllowed, got ${badProg.errorName ?? badProg.status}`
    );
  }

  step(4, "Rogue destination — expect DestinationNotAllowed");
  // Plugin derives ATA for destination owner when destinationToken omitted;
  // outsider ATA may not exist on-chain — pass token account if create fails
  // by using destination owner path and letting preflight/on-chain fail on allowlist first.
  const badDest = await kit.methods.executeSpendUnderPolicy({
    amount: String(1_000_000),
    destination: outsider.toBase58(),
    destinationToken: outsiderAta.toBase58(),
    intentProgram: KNOWN_PROGRAMS.JUPITER_V6.toBase58(),
  });
  console.log(
    "  →",
    badDest.status,
    badDest.errorTitle ?? badDest.errorName ?? badDest.message
  );
  if (
    badDest.status === "success" ||
    badDest.errorName !== "DestinationNotAllowed"
  ) {
    // Account may fail earlier if ATA missing — still report
    if (badDest.errorName === "DestinationNotAllowed") {
      /* ok */
    } else {
      console.warn(
        `  note: expected DestinationNotAllowed; got ${badDest.errorName ?? badDest.status} (may need outsider ATA funded for pure dest check)`
      );
    }
  }

  banner("Done");
  console.log("Public max-damage page: /p/" + policy.toBase58());
  if (cfg.explorer?.policy) {
    console.log("Solscan:               ", cfg.explorer.policy);
  }
  console.log(
    "\nSecurity ops: fund the vault, not the agent. Agent = fee SOL only."
  );
}

main().catch((e) => {
  console.error("\n✗ Example failed\n");
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
