"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { PolicyStatus } from "@policykit/sdk";
import BN from "bn.js";
import { usePolicyKitClient } from "@/lib/policy-client";
import { getOrCreateDemoAgent } from "@/lib/demo-agent";
import { createDemoMint } from "@/lib/demo-mint";
import {
  ActivityItem,
  loadActivity,
  pushActivity,
} from "@/lib/activity";
import { STORAGE_KEYS, CLUSTER, PROGRAM_ID, RPC_URL } from "@/lib/config";
import { shortKey } from "@/lib/format";
import { WalletMultiButton } from "@/components/wallet-button";
import { StatusCard } from "@/components/status-card";
import { CreatePolicyPanel } from "@/components/create-policy-panel";
import { DepositPanel } from "@/components/deposit-panel";
import { AuthorityControls } from "@/components/authority-controls";
import { ActivityFeed } from "@/components/activity-feed";
import { AgentDemoPanel } from "@/components/agent-demo-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, RefreshCw, Shield } from "lucide-react";


function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export function DashboardApp() {
  const { client, connection, connected } = usePolicyKitClient();
  const wallet = useWallet();

  const [agent] = useState(() => getOrCreateDemoAgent());
  const [policy, setPolicy] = useState<PublicKey | null>(null);
  const [spendMint, setSpendMint] = useState<PublicKey | null>(null);
  const [mintInput, setMintInput] = useState("");
  const [status, setStatus] = useState<PolicyStatus | null>(null);
  const [vaultBalance, setVaultBalance] = useState<BN | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    setActivity(loadActivity());
    try {
      const p = localStorage.getItem(STORAGE_KEYS.policy);
      if (p) setPolicy(new PublicKey(p));
      const m = localStorage.getItem(STORAGE_KEYS.spendMint);
      if (m) {
        setSpendMint(new PublicKey(m));
        setMintInput(m);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const showError = useCallback((msg: string) => {
    setToast({ type: "err", msg });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const showOk = useCallback((msg: string) => {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const recordActivity = useCallback(
    (
      title: string,
      signature?: string,
      success = true,
      detail?: string
    ) => {
      setActivity(
        pushActivity({
          kind: success ? "spend_ok" : "spend_fail",
          title,
          detail,
          signature,
          success,
        })
      );
    },
    []
  );

  const refreshStatus = useCallback(async () => {
    if (!client || !policy) {
      setStatus(null);
      setVaultBalance(null);
      return;
    }
    setLoadingStatus(true);
    try {
      const s = await client.getPolicyStatus(policy);
      setStatus(s);
      const bal = await client.getVaultBalance(policy, s.spendMint);
      setVaultBalance(bal);
      if (!spendMint) {
        setSpendMint(s.spendMint);
        setMintInput(s.spendMint.toBase58());
      }
    } catch (e: unknown) {
      // Policy may not exist on this cluster
      console.warn(e);
    } finally {
      setLoadingStatus(false);
    }
  }, [client, policy, spendMint]);

  useEffect(() => {
    refreshStatus();
    if (!policy) return;
    const t = setInterval(refreshStatus, 12_000);
    return () => clearInterval(t);
  }, [refreshStatus, policy]);

  function persistPolicy(pk: PublicKey) {
    setPolicy(pk);
    localStorage.setItem(STORAGE_KEYS.policy, pk.toBase58());
  }

  function persistMint(pk: PublicKey) {
    setSpendMint(pk);
    setMintInput(pk.toBase58());
    localStorage.setItem(STORAGE_KEYS.spendMint, pk.toBase58());
  }

  async function handleCreateDemoMint() {
    if (!wallet.connected) {
      showError("Connect wallet first");
      return;
    }
    setBusy(true);
    try {
      const { mint, signature } = await createDemoMint(connection, wallet);
      persistMint(mint);
      setActivity(
        pushActivity({
          kind: "mint",
          title: "Created demo mint + 1M tokens",
          signature,
          success: true,
        })
      );
      showOk(`Demo mint ${shortKey(mint)}`);
    } catch (e: unknown) {
      showError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function applyMintInput() {
    try {
      const pk = new PublicKey(mintInput.trim());
      persistMint(pk);
      showOk("Spend mint set");
    } catch {
      showError("Invalid mint address");
    }
  }

  function loadPolicyInput(raw: string) {
    try {
      const pk = new PublicKey(raw.trim());
      persistPolicy(pk);
      showOk("Policy loaded");
    } catch {
      showError("Invalid policy address");
    }
  }

  return (
    <div className="relative min-h-screen bg-ink-950 bg-grid-faint bg-grid">
      <div className="pointer-events-none absolute inset-0 bg-radial-mint" />

      <header className="relative z-10 border-b border-ink-700/80 bg-ink-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-500/15 ring-1 ring-mint-500/30">
              <Shield className="h-4 w-4 text-mint-400" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-mist-100">
                PolicyKit
              </p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-mist-500">
                Agent policy control
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="muted" className="hidden font-mono sm:inline-flex">
              {CLUSTER}
            </Badge>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {/* Hero strip */}
        <section className="animate-fade-up">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-mist-100 sm:text-4xl">
            Make agents{" "}
            <span className="bg-gradient-to-r from-mint-300 to-mint-500 bg-clip-text text-transparent">
              fundable
            </span>
            — safely.
          </h1>
          <p className="mt-2 max-w-2xl text-balance text-sm text-mist-400 sm:text-base">
            Create an on-chain policy, fund the vault, watch the agent succeed
            under limits, then hit a clean rejection. Built for Colosseum
            Eternal demos.
          </p>
        </section>

        {!connected && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="flex flex-col items-start gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-400/90">
                Connect Phantom or Solflare to create policies and run the
                demo. Use a cluster where PolicyKit is deployed (
                <span className="font-mono">{CLUSTER}</span>
                ).
              </p>
              <WalletMultiButton />
            </CardContent>
          </Card>
        )}

        {/* Status first */}
        <section className="animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist-500">
              At a glance
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshStatus()}
              disabled={!policy || !client}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingStatus ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
          <StatusCard
            status={status}
            vaultBalance={vaultBalance}
            loading={loadingStatus}
          />
        </section>

        {/* Setup row */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-mint-400" />
                Spend mint
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Mint address</Label>
                <Input
                  value={mintInput}
                  onChange={(e) => setMintInput(e.target.value)}
                  placeholder="Paste mint or create demo mint"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={applyMintInput}
                  disabled={!mintInput}
                >
                  Use mint
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateDemoMint}
                  disabled={busy || !connected}
                >
                  Create demo mint
                </Button>
              </div>
              {spendMint && (
                <p className="font-mono text-xs text-mist-400">
                  Active: {shortKey(spendMint, 6)}
                </p>
              )}
              <div className="space-y-1.5 border-t border-ink-700 pt-3">
                <Label>Load existing policy</Label>
                <Input
                  placeholder="Policy PDA"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      loadPolicyInput((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <p className="text-[11px] text-mist-500">
                  Press Enter to load. Agent:{" "}
                  <span className="font-mono">
                    {shortKey(agent.publicKey, 4)}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {client && (
            <div className="lg:col-span-2">
              <CreatePolicyPanel
                client={client}
                agentPubkey={agent.publicKey}
                spendMint={spendMint}
                busy={busy}
                setBusy={setBusy}
                onError={showError}
                onActivity={(title, sig) => {
                  setActivity(
                    pushActivity({
                      kind: "create",
                      title,
                      signature: sig,
                      success: true,
                    })
                  );
                  showOk(title);
                }}
                onCreated={(pk) => {
                  persistPolicy(pk);
                  refreshStatus();
                }}
              />
            </div>
          )}
        </section>

        {/* Controls + deposit + demo */}
        {client && (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <DepositPanel
                client={client}
                policy={policy}
                mint={spendMint}
                busy={busy}
                setBusy={setBusy}
                onDone={() => {
                  refreshStatus();
                  showOk("Deposit confirmed");
                }}
                onError={showError}
                onActivity={(title, sig) => {
                  setActivity(
                    pushActivity({
                      kind: "deposit",
                      title,
                      signature: sig,
                      success: true,
                    })
                  );
                }}
              />
              <AuthorityControls
                client={client}
                policy={policy}
                mint={spendMint}
                status={status}
                busy={busy}
                setBusy={setBusy}
                onDone={() => {
                  refreshStatus();
                }}
                onError={showError}
                onActivity={(title, sig) => {
                  setActivity(
                    pushActivity({
                      kind: "pause",
                      title,
                      signature: sig,
                      success: true,
                    })
                  );
                }}
              />
            </div>
            <AgentDemoPanel
              client={client}
              policy={policy}
              mint={spendMint}
              agent={agent}
              busy={busy}
              setBusy={setBusy}
              onDone={() => refreshStatus()}
              onError={showError}
              onActivity={recordActivity}
            />
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ActivityFeed items={activity} />
          </div>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Demo checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-mist-400">
              <Step n={1} text="Connect wallet on the right cluster" />
              <Step n={2} text="Create demo mint (or paste USDC mint)" />
              <Step n={3} text="Create Conservative trading policy" />
              <Step n={4} text="Deposit into the vault" />
              <Step n={5} text="Run “success → fail sequence”" />
              <Step n={6} text="Show remaining budget + Solscan links" />
              <div className="mt-4 rounded-lg border border-ink-600 bg-ink-950/50 p-3 font-mono text-[11px] text-mist-500">
                <div>RPC: {RPC_URL.replace(/^https?:\/\//, "").slice(0, 40)}</div>
                <div>Program: {shortKey(PROGRAM_ID, 6)}</div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-panel animate-fade-up ${
            toast.type === "ok"
              ? "border-mint-500/30 bg-ink-900 text-mint-300"
              : "border-coral-500/30 bg-ink-900 text-coral-400"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-700 font-mono text-[10px] text-mint-400">
        {n}
      </span>
      <span>{text}</span>
    </div>
  );
}
