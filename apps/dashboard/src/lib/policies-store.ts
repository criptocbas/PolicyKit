"use client";

import { STORAGE_KEYS } from "./config";

export interface StoredPolicy {
  address: string;
  policyId: number;
  spendMint: string;
  label?: string;
  createdAt: number;
}

function migrateLegacyPolicy(): void {
  if (typeof window === "undefined") return;
  try {
    const listRaw = localStorage.getItem(STORAGE_KEYS.policies);
    if (listRaw) return;
    const legacy = localStorage.getItem(STORAGE_KEYS.policy);
    const mint = localStorage.getItem(STORAGE_KEYS.spendMint);
    if (!legacy) return;
    const seed: StoredPolicy[] = [
      {
        address: legacy,
        policyId: 0,
        spendMint: mint ?? "",
        label: "Migrated",
        createdAt: Math.floor(Date.now() / 1000),
      },
    ];
    localStorage.setItem(STORAGE_KEYS.policies, JSON.stringify(seed));
    localStorage.setItem(STORAGE_KEYS.activePolicy, legacy);
  } catch {
    /* ignore */
  }
}

export function loadPolicies(): StoredPolicy[] {
  if (typeof window === "undefined") return [];
  migrateLegacyPolicy();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.policies);
    if (!raw) return [];
    return JSON.parse(raw) as StoredPolicy[];
  } catch {
    return [];
  }
}

export function savePolicies(list: StoredPolicy[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.policies, JSON.stringify(list));
}

export function upsertPolicy(p: StoredPolicy): StoredPolicy[] {
  const list = loadPolicies().filter((x) => x.address !== p.address);
  const next = [p, ...list].slice(0, 30);
  savePolicies(next);
  setActivePolicyAddress(p.address);
  localStorage.setItem(STORAGE_KEYS.policy, p.address);
  if (p.spendMint) {
    localStorage.setItem(STORAGE_KEYS.spendMint, p.spendMint);
  }
  return next;
}

export function removePolicy(address: string): StoredPolicy[] {
  const next = loadPolicies().filter((x) => x.address !== address);
  savePolicies(next);
  if (getActivePolicyAddress() === address) {
    const fallback = next[0]?.address ?? null;
    setActivePolicyAddress(fallback);
    if (fallback) {
      localStorage.setItem(STORAGE_KEYS.policy, fallback);
    } else {
      localStorage.removeItem(STORAGE_KEYS.policy);
    }
  }
  return next;
}

export function getActivePolicyAddress(): string | null {
  if (typeof window === "undefined") return null;
  migrateLegacyPolicy();
  return (
    localStorage.getItem(STORAGE_KEYS.activePolicy) ||
    localStorage.getItem(STORAGE_KEYS.policy)
  );
}

export function setActivePolicyAddress(address: string | null): void {
  if (typeof window === "undefined") return;
  if (address) {
    localStorage.setItem(STORAGE_KEYS.activePolicy, address);
    localStorage.setItem(STORAGE_KEYS.policy, address);
  } else {
    localStorage.removeItem(STORAGE_KEYS.activePolicy);
    localStorage.removeItem(STORAGE_KEYS.policy);
  }
}
