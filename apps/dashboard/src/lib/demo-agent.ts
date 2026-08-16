"use client";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { STORAGE_KEYS } from "./config";

/**
 * Load or create a tab-scoped demo agent keypair (browser sessionStorage).
 * Call only from client effects / event handlers — never during SSR render.
 * Session storage survives reloads in this tab but is cleared when the tab
 * session ends. This remains demo-only and is not production key custody.
 */
export function getOrCreateDemoAgent(): Keypair {
  if (typeof window === "undefined") {
    throw new Error(
      "getOrCreateDemoAgent must only run in the browser (use useEffect)"
    );
  }
  try {
    const existing = sessionStorage.getItem(STORAGE_KEYS.agentSecret);
    if (existing) {
      return Keypair.fromSecretKey(bs58.decode(existing));
    }
  } catch {
    /* regenerate */
  }
  const kp = Keypair.generate();
  sessionStorage.setItem(STORAGE_KEYS.agentSecret, bs58.encode(kp.secretKey));
  return kp;
}

export function resetDemoAgent(): Keypair {
  const kp = Keypair.generate();
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEYS.agentSecret, bs58.encode(kp.secretKey));
  }
  return kp;
}
