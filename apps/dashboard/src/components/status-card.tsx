"use client";

import { PolicyStatus } from "@policykit/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { shortKey, toUiAmount } from "@/lib/format";
import { solscanAddress } from "@/lib/solscan";
import { ExternalLink, Shield, Zap } from "lucide-react";
import BN from "bn.js";

export function StatusCard({
  status,
  vaultBalance,
  loading,
}: {
  status: PolicyStatus | null;
  vaultBalance: BN | null;
  loading?: boolean;
}) {
  if (!status) {
    return (
      <Card className="relative overflow-hidden border-mint-500/20">
        <div className="pointer-events-none absolute inset-0 bg-radial-mint" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-mint-500" />
            Policy status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-mist-400">
            Connect a wallet and create or load a policy to see live limits.
          </p>
        </CardContent>
      </Card>
    );
  }

  const stateVariant = status.isPaused
    ? "warn"
    : status.isExpired
      ? "danger"
      : status.isActive
        ? "success"
        : "muted";
  const stateLabel = status.isPaused
    ? "Paused"
    : status.isExpired
      ? "Expired"
      : status.isActive
        ? "Active"
        : "Inactive";

  const remainingDaily =
    status.remainingDaily === null
      ? "∞"
      : toUiAmount(status.remainingDaily);
  const remainingActions =
    status.remainingActions === null
      ? "∞"
      : String(status.remainingActions);

  return (
    <Card className="relative overflow-hidden border-mint-500/25 shadow-glow">
      <div className="pointer-events-none absolute inset-0 bg-radial-mint" />
      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-mint-500/80">
              Live policy
            </p>
            <CardTitle className="font-display text-xl tracking-tight">
              Remaining budget
            </CardTitle>
          </div>
          <Badge
            variant={
              stateVariant as "success" | "danger" | "warn" | "muted" | "default"
            }
            className="mt-1"
          >
            <span
              className={
                status.isActive && !status.isPaused
                  ? "mr-1.5 inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-mint-400"
                  : "mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
              }
            />
            {stateLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric
            label="Daily left"
            value={remainingDaily}
            unit="tokens"
            emphasize
            loading={loading}
          />
          <Metric
            label="Actions left"
            value={remainingActions}
            unit="in window"
            loading={loading}
          />
          <Metric
            label="Vault"
            value={
              vaultBalance === null ? "—" : toUiAmount(vaultBalance)
            }
            unit="balance"
            loading={loading}
          />
        </div>

        <div className="grid gap-2 rounded-xl border border-ink-600/80 bg-ink-950/50 p-3 text-sm">
          <Row
            label="Policy"
            value={
              <a
                href={solscanAddress(status.address.toBase58())}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-mint-400 hover:text-mint-300"
              >
                {shortKey(status.address, 6)}
                <ExternalLink className="h-3 w-3" />
              </a>
            }
          />
          <Row label="Agent" value={<span className="font-mono">{shortKey(status.agent, 6)}</span>} />
          <Row
            label="Spend mint"
            value={
              <span className="font-mono">{shortKey(status.spendMint, 6)}</span>
            }
          />
          <Row
            label="Spent today"
            value={
              <span className="font-mono">
                {toUiAmount(status.spentToday)} /{" "}
                {status.maxPerDay.isZero()
                  ? "∞"
                  : toUiAmount(status.maxPerDay)}
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
        </div>

        {status.inactiveReason && (
          <p className="flex items-center gap-2 text-sm text-amber-400">
            <Zap className="h-4 w-4" />
            {status.inactiveReason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  unit,
  emphasize,
  loading,
}: {
  label: string;
  value: string;
  unit: string;
  emphasize?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={
        emphasize
          ? "rounded-xl border border-mint-500/20 bg-mint-500/5 p-3"
          : "rounded-xl border border-ink-600/60 bg-ink-950/40 p-3"
      }
    >
      <p className="text-[11px] uppercase tracking-wider text-mist-400">
        {label}
      </p>
      <p
        className={
          emphasize
            ? "mt-1 font-mono text-2xl font-semibold tracking-tight text-mint-300"
            : "mt-1 font-mono text-xl font-semibold text-mist-100"
        }
      >
        {loading ? "…" : value}
      </p>
      <p className="text-[11px] text-mist-500">{unit}</p>
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
