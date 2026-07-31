"use client";

import { PolicyStatus, MaxDamageReport } from "@policykit/sdk";
import BN from "bn.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { shortKey, toUiAmount } from "@/lib/format";
import { solscanAddress } from "@/lib/solscan";
import { formatMaxDamageLines } from "@/lib/max-damage-format";
import { ExternalLink, ShieldAlert } from "lucide-react";

export function PublicPolicyView({
  address,
  status,
  vaultBalance,
  maxDamage,
  error,
}: {
  address: string;
  status: PolicyStatus | null;
  vaultBalance: BN | null;
  maxDamage: MaxDamageReport | null;
  error?: string | null;
}) {
  if (error) {
    return (
      <Card className="border-coral-500/30">
        <CardContent className="py-8 text-sm text-coral-400">{error}</CardContent>
      </Card>
    );
  }
  if (!status || !maxDamage) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-mist-500">Loading policy…</CardContent>
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

  return (
    <div className="space-y-4">
      <Card className="border-mint-500/25">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="font-display text-xl">Public policy</CardTitle>
              <CardDescription>
                Read-only view — no wallet required. Share this page with judges.
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
            value={<span className="font-mono">{shortKey(status.agent, 6)}</span>}
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
        </CardContent>
      </Card>

      <Card className="border-coral-500/30 bg-coral-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-coral-300">
            <ShieldAlert className="h-4 w-4" />
            If agent key is stolen right now
          </CardTitle>
          <CardDescription className="text-mist-400">
            Economic bound — not full sandbox. Authority can pause and clawback.
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
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-mist-400">{label}</span>
      <span className="text-mist-100">{value}</span>
    </div>
  );
}
