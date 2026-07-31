"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  POLICY_TEMPLATES,
  PolicyTemplateName,
  KNOWN_PROGRAMS,
  PolicyKitClient,
} from "@policykit/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { fromUiAmount } from "@/lib/format";
import { cn } from "@/lib/utils";


import { friendlyErrorMessage } from "@/lib/wallet-errors";

const TEMPLATE_META: Record<
  PolicyTemplateName,
  { title: string; blurb: string; tag: string }
> = {
  conservativeTrading: {
    title: "Conservative trading",
    blurb: "Tight daily budget, Jupiter-only, rate limited. Pitch-demo default.",
    tag: "Demo",
  },
  x402Payments: {
    title: "x402 payments",
    blurb: "Small per-tx caps for API / micropayment agents.",
    tag: "Payments",
  },
  researchLimitedSpend: {
    title: "Research + limited spend",
    blurb: "Very small budget, 24h expiry, few actions.",
    tag: "Research",
  },
};

export function CreatePolicyPanel({
  client,
  agentPubkey,
  spendMint,
  onCreated,
  busy,
  setBusy,
  onError,
  onActivity,
}: {
  client: PolicyKitClient;
  agentPubkey: PublicKey;
  spendMint: PublicKey | null;
  onCreated: (policy: PublicKey, policyId: number) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onError: (msg: string) => void;
  onActivity: (title: string, sig?: string) => void;
}) {
  const [template, setTemplate] =
    useState<PolicyTemplateName>("conservativeTrading");
  const [maxPerTx, setMaxPerTx] = useState("20");
  const [maxPerDay, setMaxPerDay] = useState("50");
  const [maxActions, setMaxActions] = useState("10");
  const [windowSeconds, setWindowSeconds] = useState("60");
  // Stable default for SSR; set a unique id once on the client.
  const [policyId, setPolicyId] = useState("1");

  useEffect(() => {
    setPolicyId(String(Math.floor(Date.now() / 1000) % 1_000_000));
  }, []);

  // Sync editable fields when template changes
  useEffect(() => {
    if (!spendMint) return;
    const defaults = POLICY_TEMPLATES[template]({
      agent: agentPubkey,
      spendMint,
      decimals: 6,
      extraPrograms:
        template === "x402Payments" ? [KNOWN_PROGRAMS.JUPITER_V6] : undefined,
    });
    setMaxPerTx(String(Number(defaults.maxPerTransaction.toString()) / 1e6));
    setMaxPerDay(String(Number(defaults.maxPerDay.toString()) / 1e6));
    setMaxActions(String(defaults.maxActionsPerWindow));
    setWindowSeconds(String(defaults.windowSeconds));
  }, [template, agentPubkey, spendMint]);

  async function handleCreate() {
    if (!spendMint) {
      onError("Create a demo mint or set a spend mint first.");
      return;
    }
    setBusy(true);
    try {
      const base = POLICY_TEMPLATES[template]({
        agent: agentPubkey,
        spendMint,
        decimals: 6,
        extraPrograms:
          template === "x402Payments"
            ? [KNOWN_PROGRAMS.JUPITER_V6]
            : undefined,
      });
      const params = {
        ...base,
        maxPerTransaction: fromUiAmount(maxPerTx),
        maxPerDay: fromUiAmount(maxPerDay),
        maxActionsPerWindow: Number(maxActions) || 0,
        windowSeconds: Number(windowSeconds) || 60,
        // Ensure x402 always has a program to allow for demo
        programAllowlistEnabled: true,
        programAllowlist:
          base.programAllowlist.length > 0
            ? base.programAllowlist
            : [KNOWN_PROGRAMS.JUPITER_V6],
      };
      const id = Number(policyId) || Date.now() % 1_000_000;
      const { policy, signature } = await client.createPolicy(id, params);
      onActivity(`Created policy #${id}`, signature);
      onCreated(policy, id);
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create policy</CardTitle>
        <CardDescription>
          Pick a template, tweak limits, deploy on-chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          {(Object.keys(TEMPLATE_META) as PolicyTemplateName[]).map((key) => {
            const meta = TEMPLATE_META[key];
            const selected = template === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTemplate(key)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all",
                  selected
                    ? "border-mint-500/40 bg-mint-500/10 shadow-glow"
                    : "border-ink-600 bg-ink-950/40 hover:border-mist-500/30"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-mist-100">
                    {meta.title}
                  </span>
                  <Badge variant={selected ? "success" : "muted"}>
                    {meta.tag}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-mist-400">{meta.blurb}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Policy ID" value={policyId} onChange={setPolicyId} />
          <Field label="Per-tx max" value={maxPerTx} onChange={setMaxPerTx} />
          <Field label="Daily max" value={maxPerDay} onChange={setMaxPerDay} />
          <Field
            label="Max actions / window"
            value={maxActions}
            onChange={setMaxActions}
          />
          <Field
            label="Window (sec)"
            value={windowSeconds}
            onChange={setWindowSeconds}
          />
        </div>

        <p className="text-xs text-mist-500">
          Agent:{" "}
          <span className="font-mono text-mist-300">
            {agentPubkey.toBase58().slice(0, 12)}…
          </span>{" "}
          · Allowlist includes Jupiter by default
        </p>

        <Button
          className="w-full"
          disabled={busy || !spendMint}
          onClick={handleCreate}
        >
          {busy ? "Creating…" : "Create policy"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
