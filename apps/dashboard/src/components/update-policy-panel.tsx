"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { PolicyKitClient, PolicyStatus, KNOWN_PROGRAMS } from "@policykit/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromUiAmount, toUiAmount } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/wallet-errors";
import { Settings2 } from "lucide-react";

function parsePubkeyList(raw: string): PublicKey[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new PublicKey(s));
}

export function UpdatePolicyPanel({
  client,
  policy,
  status,
  busy,
  setBusy,
  onDone,
  onError,
  onActivity,
}: {
  client: PolicyKitClient;
  policy: PublicKey | null;
  status: PolicyStatus | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  onActivity: (title: string, sig?: string) => void;
}) {
  const [maxPerTx, setMaxPerTx] = useState("20");
  const [maxPerDay, setMaxPerDay] = useState("50");
  const [maxActions, setMaxActions] = useState("10");
  const [windowSeconds, setWindowSeconds] = useState("60");
  const [neverExpires, setNeverExpires] = useState(true);
  const [hoursFromNow, setHoursFromNow] = useState("24");
  const [programAllow, setProgramAllow] = useState(KNOWN_PROGRAMS.JUPITER_V6.toBase58());
  const [destAllow, setDestAllow] = useState("");
  const [destEnabled, setDestEnabled] = useState(true);

  useEffect(() => {
    if (!status) return;
    setMaxPerTx(
      status.maxPerTransaction.isZero()
        ? "0"
        : toUiAmount(status.maxPerTransaction)
    );
    setMaxPerDay(
      status.maxPerDay.isZero() ? "0" : toUiAmount(status.maxPerDay)
    );
    setMaxActions(String(status.policy.maxActionsPerWindow));
    setWindowSeconds(String(status.policy.windowSeconds));
    setNeverExpires(status.policy.expiresAt.isZero());
    setProgramAllow(
      status.programAllowlist.map((p) => p.toBase58()).join("\n") ||
        KNOWN_PROGRAMS.JUPITER_V6.toBase58()
    );
    setDestEnabled(status.destinationAllowlistEnabled);
    setDestAllow(
      (status.destinationAllowlist ?? []).map((p) => p.toBase58()).join("\n")
    );
  }, [status]);

  async function handleUpdate() {
    if (!policy) return;
    setBusy(true);
    try {
      let programList: PublicKey[] = [];
      try {
        programList = parsePubkeyList(programAllow);
      } catch {
        onError("Invalid program allowlist pubkey");
        return;
      }
      if (programList.length === 0) {
        onError("Program allowlist cannot be empty when enabled");
        return;
      }

      let destList: PublicKey[] = [];
      if (destEnabled) {
        try {
          destList = parsePubkeyList(destAllow);
        } catch {
          onError("Invalid destination owner pubkey");
          return;
        }
        if (destList.length === 0) {
          onError("Destination allowlist enabled but empty");
          return;
        }
      }

      const expiresAt = neverExpires
        ? 0
        : Math.floor(Date.now() / 1000) + Math.max(1, Number(hoursFromNow) || 24) * 3600;

      const sig = await client.updatePolicy(policy, {
        expiresAt,
        maxPerTransaction: fromUiAmount(maxPerTx),
        maxPerDay: fromUiAmount(maxPerDay),
        maxActionsPerWindow: Number(maxActions) || 0,
        windowSeconds: Number(windowSeconds) || 60,
        programAllowlistEnabled: true,
        programAllowlist: programList,
        programDenylistEnabled: false,
        programDenylist: [],
        mintAllowlistEnabled: true,
        mintAllowlist: status ? [status.spendMint] : [],
        destinationAllowlistEnabled: destEnabled,
        destinationAllowlist: destList,
      });
      onActivity("Policy updated", sig);
      onDone();
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-mint-400" />
          Update policy
        </CardTitle>
        <CardDescription>
          Change limits, program allowlist, expiry, and destination owners.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Per-tx max" value={maxPerTx} onChange={setMaxPerTx} />
          <Field label="Daily max" value={maxPerDay} onChange={setMaxPerDay} />
          <Field label="Max actions" value={maxActions} onChange={setMaxActions} />
          <Field label="Window (sec)" value={windowSeconds} onChange={setWindowSeconds} />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <input
            id="never-exp"
            type="checkbox"
            checked={neverExpires}
            onChange={(e) => setNeverExpires(e.target.checked)}
            className="rounded border-ink-600"
          />
          <Label htmlFor="never-exp">Never expires</Label>
        </div>
        {!neverExpires && (
          <Field
            label="Expires in (hours)"
            value={hoursFromNow}
            onChange={setHoursFromNow}
          />
        )}

        <div className="space-y-1.5">
          <Label>Program allowlist (one per line)</Label>
          <textarea
            className="min-h-[64px] w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 font-mono text-xs text-mist-100"
            value={programAllow}
            onChange={(e) => setProgramAllow(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <input
            id="dest-en"
            type="checkbox"
            checked={destEnabled}
            onChange={(e) => setDestEnabled(e.target.checked)}
            className="rounded border-ink-600"
          />
          <Label htmlFor="dest-en">Destination owner allowlist</Label>
        </div>
        {destEnabled && (
          <div className="space-y-1.5">
            <Label>Allowed wallet owners (not ATAs)</Label>
            <textarea
              className="min-h-[56px] w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 font-mono text-xs text-mist-100"
              value={destAllow}
              onChange={(e) => setDestAllow(e.target.value)}
              placeholder="Agent pubkey…"
            />
          </div>
        )}

        <Button
          className="w-full"
          disabled={busy || !policy || !status}
          onClick={handleUpdate}
        >
          {busy ? "Updating…" : "Update on-chain"}
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
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
