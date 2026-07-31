"use client";

import { useState } from "react";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PolicyKitClient,
  PolicyKitError,
  KNOWN_PROGRAMS,
  POLICYKIT_ERROR_TITLES,
  mapPolicyKitError,
} from "@policykit/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fromUiAmount } from "@/lib/format";
import {
  friendlyErrorMessage,
  isWalletApprovalDenied,
} from "@/lib/wallet-errors";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type DemoResult = {
  ok: boolean;
  title: string;
  message: string;
  signature?: string;
  /** Soft cancel — not an on-chain policy rejection */
  cancelled?: boolean;
};

export function AgentDemoPanel({
  client,
  policy,
  mint,
  agent,
  busy,
  setBusy,
  onDone,
  onError,
  onActivity,
}: {
  client: PolicyKitClient;
  policy: PublicKey | null;
  mint: PublicKey | null;
  agent: Keypair;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  onActivity: (
    title: string,
    sig?: string,
    success?: boolean,
    detail?: string
  ) => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [last, setLast] = useState<DemoResult | null>(null);
  const [log, setLog] = useState<DemoResult[]>([]);

  async function ensureAgentAta(): Promise<PublicKey> {
    if (!mint || !wallet.publicKey || !wallet.sendTransaction) {
      throw new Error("Wallet / mint missing");
    }
    const ata = getAssociatedTokenAddressSync(
      mint,
      agent.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const info = await connection.getAccountInfo(ata);
    if (info) return ata;

    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        ata,
        agent.publicKey,
        mint
      )
    );
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;
    const sig = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return ata;
  }

  function applyResult(result: DemoResult) {
    setLast(result);
    if (!result.cancelled) {
      setLog((l) => [result, ...l].slice(0, 8));
    }
    if (result.ok) {
      onDone();
    } else if (result.cancelled) {
      onError(result.message);
    } else {
      onDone();
    }
  }

  async function ensureOwnerAta(owner: PublicKey): Promise<PublicKey> {
    if (!mint || !wallet.publicKey || !wallet.sendTransaction) {
      throw new Error("Wallet / mint missing");
    }
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const info = await connection.getAccountInfo(ata);
    if (info) return ata;

    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        ata,
        owner,
        mint
      )
    );
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;
    const sig = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    return ata;
  }

  async function runSpend(
    amountUi: string,
    intent: PublicKey,
    label: string,
    destOwner?: PublicKey
  ): Promise<DemoResult> {
    if (!policy || !mint) {
      throw new Error("Create a policy and mint first.");
    }
    try {
      const owner = destOwner ?? agent.publicKey;
      const dest =
        owner.equals(agent.publicKey)
          ? await ensureAgentAta()
          : await ensureOwnerAta(owner);
      const sig = await client.executeSpend({
        policy,
        mint,
        amount: fromUiAmount(amountUi),
        intentProgram: intent,
        destination: dest,
        agent: agent.publicKey,
        signers: [agent],
      });
      const result: DemoResult = {
        ok: true,
        title: "Spend allowed",
        message: `${label}: agent spent ${amountUi} under policy.`,
        signature: sig,
      };
      onActivity(result.title, sig, true, result.message);
      return result;
    } catch (e: unknown) {
      if (isWalletApprovalDenied(e)) {
        return {
          ok: false,
          cancelled: true,
          title: "Cancelled",
          message: "Transaction cancelled in wallet — nothing was sent.",
        };
      }
      const mapped =
        e instanceof PolicyKitError ? e.toJSON() : mapPolicyKitError(e);
      const title =
        mapped.name !== "Unknown" && mapped.name in POLICYKIT_ERROR_TITLES
          ? POLICYKIT_ERROR_TITLES[mapped.name as keyof typeof POLICYKIT_ERROR_TITLES]
          : mapped.title;
      const result: DemoResult = {
        ok: false,
        title,
        message: mapped.message,
      };
      onActivity(title, undefined, false, mapped.message);
      return result;
    }
  }

  async function handleSuccess() {
    setBusy(true);
    try {
      applyResult(
        await runSpend("5", KNOWN_PROGRAMS.JUPITER_V6, "Jupiter intent")
      );
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleForbidden() {
    setBusy(true);
    try {
      applyResult(await runSpend("1", KNOWN_PROGRAMS.DRIFT, "Drift intent"));
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleOverBudget() {
    setBusy(true);
    try {
      applyResult(
        await runSpend("999999", KNOWN_PROGRAMS.JUPITER_V6, "Blow budget")
      );
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleBadDestination() {
    if (!wallet.publicKey) {
      onError("Connect wallet first");
      return;
    }
    setBusy(true);
    try {
      // Authority wallet is almost never on the agent-only destination allowlist.
      applyResult(
        await runSpend(
          "1",
          KNOWN_PROGRAMS.JUPITER_V6,
          "Outsider destination",
          wallet.publicKey
        )
      );
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDemoSequence() {
    setBusy(true);
    try {
      const ok = await runSpend("5", KNOWN_PROGRAMS.JUPITER_V6, "Step 1");
      if (ok.cancelled) {
        applyResult(ok);
        return;
      }
      setLog((l) => [ok, ...l]);
      const bad = await runSpend("1", KNOWN_PROGRAMS.DRIFT, "Step 2");
      setLast(bad);
      if (!bad.cancelled) {
        setLog((l) => [bad, ok, ...l].slice(0, 8));
      }
      if (bad.cancelled) {
        onError(bad.message);
      } else {
        onDone();
      }
    } catch (e: unknown) {
      onError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-mint-500/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-mint-400" />
              Agent demo
            </CardTitle>
            <CardDescription>
              30-second pitch path: success under policy → clean on-chain
              rejection with exact PolicyKit error titles.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            disabled={busy || !policy || !mint}
            onClick={handleSuccess}
            variant="success"
          >
            <CheckCircle2 className="h-4 w-4" />
            Allowed spend (Jupiter)
          </Button>
          <Button
            disabled={busy || !policy || !mint}
            onClick={handleForbidden}
            variant="danger"
          >
            <XCircle className="h-4 w-4" />
            Forbidden (Drift)
          </Button>
          <Button
            disabled={busy || !policy || !mint}
            onClick={handleOverBudget}
            variant="outline"
          >
            Blow daily / per-tx limit
          </Button>
          <Button
            disabled={busy || !policy || !mint || !wallet.publicKey}
            onClick={handleBadDestination}
            variant="outline"
          >
            Pay outsider (dest deny)
          </Button>
          <Button
            className="sm:col-span-2"
            disabled={busy || !policy || !mint}
            onClick={handleDemoSequence}
          >
            Run success → fail sequence
          </Button>
        </div>

        {last && (
          <div
            className={cn(
              "rounded-xl border p-4 animate-fade-up",
              last.ok
                ? "border-mint-500/30 bg-mint-500/10 shadow-glow"
                : last.cancelled
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-coral-500/35 bg-coral-500/10 shadow-glow-coral"
            )}
          >
            <div className="flex items-center gap-2">
              {last.ok ? (
                <CheckCircle2 className="h-5 w-5 text-mint-400" />
              ) : (
                <XCircle
                  className={cn(
                    "h-5 w-5",
                    last.cancelled ? "text-amber-400" : "text-coral-400"
                  )}
                />
              )}
              <p
                className={cn(
                  "font-display text-lg font-semibold tracking-tight",
                  last.ok
                    ? "text-mint-300"
                    : last.cancelled
                      ? "text-amber-400"
                      : "text-coral-400"
                )}
              >
                {last.title}
              </p>
              <Badge
                variant={
                  last.ok ? "success" : last.cancelled ? "warn" : "danger"
                }
                className="ml-auto"
              >
                {last.ok
                  ? "on-chain ok"
                  : last.cancelled
                    ? "cancelled"
                    : "on-chain reject"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-mist-300">{last.message}</p>
            {last.signature && (
              <p className="mt-2 font-mono text-xs text-mist-500">
                sig {last.signature.slice(0, 20)}…
              </p>
            )}
          </div>
        )}

        {log.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-mist-500">
              Session results
            </p>
            {log.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-ink-600/60 bg-ink-950/40 px-3 py-2 text-sm"
              >
                <span className={r.ok ? "text-mint-400" : "text-coral-400"}>
                  {r.title}
                </span>
                <span className="text-xs text-mist-500">
                  {r.ok ? "allowed" : "blocked"}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs leading-relaxed text-mist-500">
          Agent key is a demo keypair stored in this browser. Authority wallet
          pays fees; agent co-signs <code className="text-mist-400">execute_spend</code>.
          Conservative policies allowlist Jupiter + agent as destination owner.
          Forbidden: Drift intent, outsider destination, or over budget.
        </p>
      </CardContent>
    </Card>
  );
}
