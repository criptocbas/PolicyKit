"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { PolicyStatus, MaxDamageReport } from "@policykit/sdk";
import BN from "bn.js";
import { PublicPolicyView } from "@/components/public-policy-view";
import { fetchPublicPolicy } from "@/lib/readonly-client";
import { CLUSTER, PROGRAM_ID } from "@/lib/config";
import { shortKey } from "@/lib/format";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function PublicPolicyPage() {
  const params = useParams();
  const address = String(params.address ?? "");
  const [status, setStatus] = useState<PolicyStatus | null>(null);
  const [vaultBalance, setVaultBalance] = useState<BN | null>(null);
  const [maxDamage, setMaxDamage] = useState<MaxDamageReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        new PublicKey(address);
      } catch {
        setError("Invalid policy address");
        return;
      }
      try {
        const data = await fetchPublicPolicy(address);
        if (cancelled) return;
        setStatus(data.status);
        setVaultBalance(data.vaultBalance);
        setMaxDamage(data.maxDamage);
        setError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load policy (wrong cluster or not found)"
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <div className="min-h-screen bg-ink-950 bg-grid-faint bg-grid">
      <div className="pointer-events-none absolute inset-0 bg-radial-mint" />
      <header className="relative z-10 border-b border-ink-700/80 bg-ink-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-mist-100">
            <Shield className="h-4 w-4 text-mint-400" />
            <span className="font-display font-semibold">PolicyKit</span>
          </Link>
          <span className="font-mono text-[11px] text-mist-500">
            {CLUSTER} · {shortKey(PROGRAM_ID.toBase58(), 4)}
          </span>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-2xl space-y-4 px-4 py-8">
        <h1 className="font-display text-2xl font-semibold text-mist-100">
          Compromised-agent bounds
        </h1>
        <p className="text-sm text-mist-400">
          Open on-chain policy for Solana agents. If the hot key is stolen,
          damage is limited by these rules.
        </p>
        <PublicPolicyView
          address={address}
          status={status}
          vaultBalance={vaultBalance}
          maxDamage={maxDamage}
          error={error}
        />
        <p className="text-center text-xs text-mist-500">
          <Link href="/" className="text-mint-400 hover:underline">
            Open control room
          </Link>
        </p>
      </main>
    </div>
  );
}
