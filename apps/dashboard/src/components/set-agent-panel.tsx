"use client";

import { useState } from "react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { PolicyKitClient, PolicyStatus } from "@policykit/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortKey } from "@/lib/format";
import { resetDemoAgent } from "@/lib/demo-agent";
import { friendlyErrorMessage } from "@/lib/wallet-errors";
import { UserCog } from "lucide-react";

export function SetAgentPanel({
  client,
  policy,
  status,
  demoAgent,
  busy,
  setBusy,
  onAgentChange,
  onDone,
  onError,
  onActivity,
}: {
  client: PolicyKitClient;
  policy: PublicKey | null;
  status: PolicyStatus | null;
  demoAgent: Keypair | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onAgentChange: (kp: Keypair) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  onActivity: (title: string, sig?: string) => void;
}) {
  const [paste, setPaste] = useState("");

  async function rotateTo(pubkey: PublicKey, label: string) {
    if (!policy) return;
    setBusy(true);
    try {
      const sig = await client.setAgent(policy, pubkey);
      onActivity(`Agent → ${label}`, sig);
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
          <UserCog className="h-4 w-4 text-mint-400" />
          Set agent
        </CardTitle>
        <CardDescription>
          Rotate the hot key allowed to call execute_spend. Old agent loses access immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-mist-400">
          On-chain agent:{" "}
          <span className="font-mono text-mist-200">
            {status ? shortKey(status.agent, 6) : "—"}
          </span>
        </p>
        <p className="text-sm text-mist-400">
          Demo agent key:{" "}
          <span className="font-mono text-mist-200">
            {demoAgent ? shortKey(demoAgent.publicKey, 6) : "—"}
          </span>
        </p>

        <Button
          className="w-full"
          variant="secondary"
          disabled={busy || !policy || !demoAgent}
          onClick={() =>
            demoAgent &&
            rotateTo(demoAgent.publicKey, shortKey(demoAgent.publicKey, 4))
          }
        >
          Use current demo agent
        </Button>

        <Button
          className="w-full"
          variant="outline"
          disabled={busy || !policy}
          onClick={async () => {
            const kp = resetDemoAgent();
            onAgentChange(kp);
            await rotateTo(kp.publicKey, "new demo key");
          }}
        >
          Generate new demo agent + set on-chain
        </Button>

        <div className="space-y-1.5 border-t border-ink-700 pt-3">
          <Label>Or paste agent pubkey</Label>
          <div className="flex gap-2">
            <Input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Public key"
            />
            <Button
              variant="secondary"
              disabled={busy || !policy || !paste.trim()}
              onClick={() => {
                try {
                  const pk = new PublicKey(paste.trim());
                  rotateTo(pk, shortKey(pk, 4));
                } catch {
                  onError("Invalid agent pubkey");
                }
              }}
            >
              Set
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
