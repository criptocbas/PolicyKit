"use client";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { STORAGE_KEYS } from "./config";

/** Load or create a persistent demo agent keypair (browser localStorage). */
export function getOrCreateDemoAgent(): Keypair {
  if (typeof window === "undefined") {
    return Keypair.generate();
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
