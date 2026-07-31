"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { PolicyKitClient } from "@policykit/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromUiAmount } from "@/lib/format";


import { friendlyErrorMessage } from "@/lib/wallet-errors";

export function DepositPanel({
  client,
  policy,
  mint,
  busy,
  setBusy,
  onDone,
  onError,
  onActivity,
}: {
  client: PolicyKitClient;
  policy: PublicKey | null;
  mint: PublicKey | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  onActivity: (title: string, sig?: string) => void;
}) {
  const [amount, setAmount] = useState("100");

  async function handleDeposit() {
    if (!policy || !mint) {
      onError("Create a policy and mint first.");
      return;
    }
    setBusy(true);
    try {
      const sig = await client.deposit({
        policy,
        mint,
        amount: fromUiAmount(amount),
      });
      onActivity(`Deposited ${amount} into vault`, sig);
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
        <CardTitle>Fund vault</CardTitle>
        <CardDescription>
          Deposit tokens into the policy vault — not the agent wallet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Amount (UI units)</Label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100"
          />
        </div>
        <Button
          className="w-full"
          variant="secondary"
          disabled={busy || !policy || !mint}
          onClick={handleDeposit}
        >
          {busy ? "Depositing…" : "Deposit"}
        </Button>
      </CardContent>
    </Card>
  );
}
