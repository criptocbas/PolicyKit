import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

export function shortKey(key: PublicKey | string, n = 4): string {
  const s = typeof key === "string" ? key : key.toBase58();
  if (s.length <= n * 2 + 1) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

export function toUiAmount(
  amount: BN | number | string | null | undefined,
  decimals = 6
): string {
  if (amount === null || amount === undefined) return "∞";
  const bn = BN.isBN(amount) ? amount : new BN(amount.toString());
  if (bn.isNeg()) return "0";
  const base = new BN(10).pow(new BN(decimals));
  const whole = bn.div(base).toString();
  const frac = bn.mod(base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export function fromUiAmount(ui: string | number, decimals = 6): BN {
  const s = String(ui).trim();
  if (!s || s === ".") return new BN(0);
  const [w, f = ""] = s.split(".");
  const frac = f.padEnd(decimals, "0").slice(0, decimals);
  const raw = `${w || "0"}${frac}`.replace(/^0+(?=\d)/, "") || "0";
  return new BN(raw);
}

export function formatTs(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
