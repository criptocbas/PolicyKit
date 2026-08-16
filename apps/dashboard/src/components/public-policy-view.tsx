"use client";

import {
  PolicyStatus,
  MaxDamageReport,
  assessPolicySafety,
} from "@policykit/sdk";
import BN from "bn.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { shortKey, toUiAmount } from "@/lib/format";
import { solscanAddress } from "@/lib/solscan";
import { formatMaxDamageLines } from "@/lib/max-damage-format";
import { CLUSTER } from "@/lib/config";
import { walletClusterHint } from "@/lib/cluster-copy";
import { ExternalLink, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { PolicySafetySummary } from "@/components/policy-safety-summary";

export function PublicPolicyView({
  address,
  status,
  vaultBalance,
  maxDamage,
  error,
  loading,
}: {
  address: string;
  status: PolicyStatus | null;
  vaultBalance: BN | null;
  maxDamage: MaxDamageReport | null;
  error?: string | null;
  loading?: boolean;
}) {
  if (error) {
    return (
      <Card className="border-coral-500/30">
        <CardHeader>
          <CardTitle className="text-coral-300">
            Could not load policy
          </CardTitle>
          <CardDescription className="text-mist-400">
            App is fixed to <span className="font-mono">{CLUSTER}</span>.{" "}
            {walletClusterHint()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-coral-400">{error}</p>
          <p className="text-mist-500">
            Try loading a known devnet policy from the control room live-proof
            card, or open{" "}
            <Link href="/" className="text-mint-400 hover:underline">
              control room
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading || !status || !maxDamage) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-mist-500">
          Loading policy from {CLUSTER}…
        </CardContent>
      </Card>
    );
  }

  const state = status.isPaused
    ? "Paused"
    : status.isExpired
    ? "Expired"
    : status.isActive
    ? "Active"
    : "Inactive";
  const safety = assessPolicySafety(status.policy, {
    vaultBalance: vaultBalance ?? undefined,
  });

  return (
    <div className="space-y-4">
      <Card className="border-mint-500/25">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="font-display text-xl">
                Public policy
              </CardTitle>
              <CardDescription>
                Read-only view — no wallet required. Share this page with
                judges.
              </CardDescription>
            </div>
            <Badge
              variant={
                state === "Active"
                  ? "success"
                  : state === "Paused"
                  ? "warn"
                  : "danger"
              }
            >
              {state}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row
            label="Policy"
            value={
              <a
                href={solscanAddress(address)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-mint-400"
              >
                {shortKey(address, 8)}
                <ExternalLink className="h-3 w-3" />
              </a>
            }
          />
          <Row
            label="Agent"
            value={
              <a
                href={solscanAddress(status.agent.toBase58())}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-mint-400"
              >
                {shortKey(status.agent, 6)}
              </a>
            }
          />
          <Row
            label="Authority"
            value={
              <a
                href={solscanAddress(status.authority.toBase58())}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-mint-400"
              >
                {shortKey(status.authority, 6)}
              </a>
            }
          />
          <Row
            label="Spend mint"
            value={
              <a
                href={solscanAddress(status.spendMint.toBase58())}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-mint-400"
              >
                {shortKey(status.spendMint, 6)}
              </a>
            }
          />
          <Row
            label="Daily left"
            value={
              <span className="font-mono">
                {status.remainingDaily === null
                  ? "∞"
                  : toUiAmount(status.remainingDaily)}
              </span>
            }
          />
          <Row
            label="Per-tx max"
            value={
              <span className="font-mono">
                {status.maxPerTransaction.isZero()
                  ? "∞"
                  : toUiAmount(status.maxPerTransaction)}
              </span>
            }
          />
          <Row
            label="Vault"
            value={
              <span className="font-mono">
                {vaultBalance === null ? "—" : toUiAmount(vaultBalance)}
              </span>
            }
          />
          <Row
            label="Destinations"
            value={
              <span className="text-xs">
                {status.destinationAllowlistEnabled
                  ? `${status.destinationAllowlist?.length ?? 0} owners`
                  : "open"}
              </span>
            }
          />
          <Row
            label="Programs"
            value={
              <span className="text-xs">
                {status.policy.programAllowlistEnabled
                  ? `${status.programAllowlist.length} allowlisted`
                  : "open"}
              </span>
            }
          />
          <Row
            label="Rate window"
            value={
              <span className="font-mono text-xs">
                {status.policy.maxActionsPerWindow === 0
                  ? "unlimited"
                  : `${status.remainingActions ?? 0} actions left / ${
                      status.policy.windowSeconds
                    }s`}
              </span>
            }
          />
        </CardContent>
      </Card>

      <PolicySafetySummary assessment={safety} />

      <Card className="border-coral-500/30 bg-coral-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-coral-300">
            <ShieldAlert className="h-4 w-4" />
            If agent key is stolen right now
          </CardTitle>
          <CardDescription className="text-mist-400">
            Vault outflows only — not a whole-agent sandbox. Zero caps or open
            lists remove the bound. Authority can pause and clawback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-mist-200">
            {formatMaxDamageLines(maxDamage).map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-coral-400">▸</span>
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-mist-500">{maxDamage.summary}</p>
          <div className="mt-4 rounded-lg border border-ink-600/60 bg-ink-950/40 p-3 text-xs text-mist-400">
            <p className="font-medium text-mist-200">
              How this bound is derived
            </p>
            <p className="mt-1">
              Values are computed from the Policy PDA fetched from RPC. The
              current-window amount uses remaining actions, the per-transaction
              cap, and remaining daily budget. Vault balance is shown
              separately. A zero cap is unlimited, and declared program intent
              is not CPI proof.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-mist-400">{label}</span>
      <span className="text-mist-100">{value}</span>
    </div>
  );
}
