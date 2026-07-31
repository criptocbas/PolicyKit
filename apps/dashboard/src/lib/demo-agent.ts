"use client";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { STORAGE_KEYS } from "./config";

/**
 * Load or create a persistent demo agent keypair (browser localStorage).
 * Call only from client effects / event handlers — never during SSR render.
 */
export function getOrCreateDemoAgent(): Keypair {
  if (typeof window === "undefined") {
    throw new Error(
      "getOrCreateDemoAgent must only run in the browser (use useEffect)"
    );
  }
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.agentSecret);
    if (existing) {
      return Keypair.fromSecretKey(bs58.decode(existing));
    }
  } catch {
    /* regenerate */
  }
  const kp = Keypair.generate();
  localStorage.setItem(STORAGE_KEYS.agentSecret, bs58.encode(kp.secretKey));
  return kp;
}

export function resetDemoAgent(): Keypair {
  const kp = Keypair.generate();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.agentSecret, bs58.encode(kp.secretKey));
  }
  return kp;
}
