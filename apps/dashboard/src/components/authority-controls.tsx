"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { PolicyKitClient, PolicyStatus } from "@policykit/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromUiAmount } from "@/lib/format";
import { Pause, Play, Undo2 } from "lucide-react";


import { friendlyErrorMessage } from "@/lib/wallet-errors";

export function AuthorityControls({
  client,
  policy,
  mint,
  status,
  busy,
  setBusy,
  onDone,
  onError,
  onActivity,
}: {
  client: PolicyKitClient;
  policy: PublicKey | null;
  mint: PublicKey | null;
  status: PolicyStatus | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  onActivity: (title: string, sig?: string) => void;
}) {
  const [clawbackAmt, setClawbackAmt] = useState("10");

  async function pause() {
    if (!policy) return;
    setBusy(true);
    try {
      const sig = await client.pausePolicy(policy);
      onActivity("Policy paused", sig);
      onDone();
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function unpause() {
    if (!policy) return;
    setBusy(true);
    try {
      const sig = await client.unpausePolicy(policy);
      onActivity("Policy unpaused", sig);
      onDone();
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function clawback() {
    if (!policy || !mint) return;
    setBusy(true);
    try {
      const sig = await client.clawback({
        policy,
        mint,
        amount: fromUiAmount(clawbackAmt),
      });
      onActivity(`Clawback ${clawbackAmt}`, sig);
      onDone();
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const paused = status?.isPaused ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authority controls</CardTitle>
        <CardDescription>
          You always retain pause and clawback power.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {paused ? (
            <Button
              className="flex-1"
              variant="success"
              disabled={busy || !policy}
              onClick={unpause}
            >
              <Play className="h-4 w-4" />
              Unpause
            </Button>
          ) : (
            <Button
              className="flex-1"
              variant="danger"
              disabled={busy || !policy}
              onClick={pause}
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Clawback amount</Label>
          <div className="flex gap-2">
            <Input
              value={clawbackAmt}
              onChange={(e) => setClawbackAmt(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={busy || !policy || !mint}
              onClick={clawback}
            >
              <Undo2 className="h-4 w-4" />
              Clawback
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
