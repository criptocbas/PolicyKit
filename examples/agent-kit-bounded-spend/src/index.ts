/**
 * Gold-standard Agent Kit + PolicyKit example (edge A + C).
 *
 * Requires: yarn agent:setup from monorepo root first.
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
const liveConfigPath =
  process.env.LIVE_CONFIG ?? path.join(ROOT, "proof", "live-config.json");
const agentKeyPath =
  process.env.AGENT_KEY ?? path.join(ROOT, "proof", ".agent-keypair.json");
const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";

function loadKeypair(p: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  if (!fs.existsSync(liveConfigPath)) {
    throw new Error(`Missing ${liveConfigPath} — run yarn agent:setup from repo root`);
  }
  if (!fs.existsSync(agentKeyPath)) {
    throw new Error(`Missing agent key ${agentKeyPath}`);
  }

  const cfg = JSON.parse(fs.readFileSync(liveConfigPath, "utf8")) as {
    policy: string;
    spendMint: string;
    programId: string;
  };
  const agent = loadKeypair(agentKeyPath);
  const policy = new PublicKey(cfg.policy);
  const mint = new PublicKey(cfg.spendMint);
  const programId = new PublicKey(cfg.programId);

  console.log("=== PolicyKit + Agent Kit (bounded spend) ===");
  console.log("RPC", RPC);
  console.log("Policy", policy.toBase58());
  console.log("Agent", agent.publicKey.toBase58());

  const connection = new Connection(RPC, "confirmed");
  const wallet = new KeypairWallet(agent, RPC);
  const kit = new SolanaAgentKit(wallet, RPC, {}).use(
    createPolicyKitPlugin({
      policy,
      programId,
      defaultMint: mint,
      defaultIntentProgram: KNOWN_PROGRAMS.JUPITER_V6,
    })
  );

  const status = await kit.methods.getPolicyStatus();
  console.log("Status", status.formatted);
  console.log(
    "Max damage if key stolen:",
    computeMaxDamage(status.policy).summary
  );

  const dest = getAssociatedTokenAddressSync(
    mint,
    agent.publicKey,
    true,
    TOKEN_PROGRAM_ID
  );

  // Allowed path
  const ok = await kit.methods.executeSpendUnderPolicy({
    amount: String(1_000_000), // 1 token @ 6 decimals
    destination: agent.publicKey.toBase58(),
    destinationToken: dest.toBase58(),
    intentProgram: KNOWN_PROGRAMS.JUPITER_V6.toBase58(),
  });
  console.log("Allowed spend:", ok.status, ok.message);

  // Rogue program
  const bad = await kit.methods.executeSpendUnderPolicy({
    amount: String(1_000_000),
    destinationToken: dest.toBase58(),
    intentProgram: KNOWN_PROGRAMS.DRIFT.toBase58(),
  });
  console.log("Rogue program:", bad.status, bad.errorTitle ?? bad.errorName);

  console.log("\nDone. Public page: /p/" + policy.toBase58());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
