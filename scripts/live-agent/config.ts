import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { POLICYKIT_PROGRAM_ID } from "@policykit/sdk";

export const ROOT = path.join(__dirname, "..", "..");
export const PROOF_DIR = path.join(ROOT, "proof");
export const PUBLIC_PROOF_DIR = path.join(
  ROOT,
  "apps",
  "dashboard",
  "public",
  "proof"
);
export const LIVE_CONFIG_PATH = path.join(PROOF_DIR, "live-config.json");
export const LIVE_FEED_PATH = path.join(PROOF_DIR, "live-feed.json");
export const LIVE_FEED_PUBLIC_PATH = path.join(
  PUBLIC_PROOF_DIR,
  "live-feed.json"
);
export const AGENT_KEY_PATH =
  process.env.AGENT_KEY ?? path.join(PROOF_DIR, ".agent-keypair.json");

export const RPC_URL = process.env.RPC_URL ?? "https://api.devnet.solana.com";
export const PROGRAM_ID = process.env.PROGRAM_ID
  ? new PublicKey(process.env.PROGRAM_ID)
  : POLICYKIT_PROGRAM_ID;

export const DECIMALS = 6;
export const ui = (n: number) => n * 10 ** DECIMALS;

export type LiveConfig = {
  cluster: string;
  rpcUrl: string;
  programId: string;
  policy: string;
  policyId: number;
  spendMint: string;
  agent: string;
  authority: string;
  createdAt: string;
  explorer: {
    policy: string;
    program: string;
  };
};

export type TickEvent = {
  ts: string;
  kind:
    | "allowed"
    | "reject_program"
    | "reject_dest"
    | "reject_budget"
    | "skip_budget"
    | "error";
  ok: boolean;
  errorName?: string;
  errorTitle?: string;
  signature?: string;
  remainingDaily?: string | null;
  message?: string;
  explorer?: { tx?: string; policy: string };
};

/** Versioned feed document written by agent:tick (array still accepted by dashboard). */
export type LiveFeedDocument = {
  version: 1;
  updatedAt: string;
  cluster: string;
  policy: string;
  programId: string;
  tickCount: number;
  events: TickEvent[];
};

export function loadKeypair(filePath: string): Keypair {
  const resolved = filePath.startsWith("~")
    ? path.join(os.homedir(), filePath.slice(1))
    : filePath;
  const raw = JSON.parse(fs.readFileSync(resolved, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function saveKeypair(filePath: string, kp: Keypair): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(Array.from(kp.secretKey)),
    { mode: 0o600 }
  );
}

export function loadLiveConfig(): LiveConfig {
  if (!fs.existsSync(LIVE_CONFIG_PATH)) {
    throw new Error(
      `Missing ${LIVE_CONFIG_PATH}. Run: yarn agent:setup`
    );
  }
  return JSON.parse(fs.readFileSync(LIVE_CONFIG_PATH, "utf8")) as LiveConfig;
}

export function writeLiveConfig(cfg: LiveConfig): void {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_PROOF_DIR, { recursive: true });
  fs.writeFileSync(LIVE_CONFIG_PATH, JSON.stringify(cfg, null, 2));
  fs.writeFileSync(
    path.join(PUBLIC_PROOF_DIR, "live-config.json"),
    JSON.stringify(cfg, null, 2)
  );
}

export function loadFeed(): TickEvent[] {
  try {
    if (!fs.existsSync(LIVE_FEED_PATH)) return [];
    const raw = JSON.parse(fs.readFileSync(LIVE_FEED_PATH, "utf8")) as unknown;
    if (Array.isArray(raw)) return raw as TickEvent[];
    if (
      raw &&
      typeof raw === "object" &&
      Array.isArray((raw as LiveFeedDocument).events)
    ) {
      return (raw as LiveFeedDocument).events;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Prepend tick events and rewrite feed as a versioned document (plus public copy).
 * Pass meta from live-config so the dashboard can show freshness without guessing.
 */
export function appendFeed(
  events: TickEvent[],
  meta?: Pick<LiveConfig, "cluster" | "policy" | "programId">
): TickEvent[] {
  const prev = loadFeed();
  const next = [...events, ...prev].slice(0, 100);
  const cfg = meta ?? (() => {
    try {
      return loadLiveConfig();
    } catch {
      return null;
    }
  })();
  const doc: LiveFeedDocument = {
    version: 1,
    updatedAt: new Date().toISOString(),
    cluster: cfg?.cluster ?? "devnet",
    policy: cfg?.policy ?? next[0]?.explorer?.policy ?? "",
    programId: cfg?.programId ?? "",
    tickCount: next.length,
    events: next,
  };
  // Prefer policy pubkey over explorer URL if we only had URL
  if (cfg?.policy) {
    doc.policy = cfg.policy;
  } else if (doc.policy.startsWith("http")) {
    try {
      const m = doc.policy.match(/account\/([1-9A-HJ-NP-Za-km-z]+)/);
      if (m) doc.policy = m[1];
    } catch {
      /* keep */
    }
  }
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_PROOF_DIR, { recursive: true });
  const body = JSON.stringify(doc, null, 2);
  fs.writeFileSync(LIVE_FEED_PATH, body);
  fs.writeFileSync(LIVE_FEED_PUBLIC_PATH, body);
  return next;
}

export function explorerTx(sig: string, cluster = "devnet"): string {
  return `https://solscan.io/tx/${sig}?cluster=${cluster}`;
}

export function explorerAccount(addr: string, cluster = "devnet"): string {
  return `https://solscan.io/account/${addr}?cluster=${cluster}`;
}
