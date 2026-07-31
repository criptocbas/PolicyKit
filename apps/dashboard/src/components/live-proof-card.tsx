"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Radio } from "lucide-react";
import { shortKey } from "@/lib/format";

export type DevnetProof = {
  cluster: string;
  programId: string;
  policy: string;
  policyId: number;
  spendMint: string;
  agent: string;
  authority: string;
  createdAt: string;
  signatures?: {
    create?: string;
    deposit?: string;
    successSpend?: string;
  };
  rejections?: {
    programNotAllowed?: { name: string; title: string };
    destinationNotAllowed?: { name: string; title: string };
  };
  remainingDaily?: string | null;
  explorer?: {
    policy?: string;
    program?: string;
    successTx?: string | null;
  };
};

const DEFAULT_PROOF_URL =
  process.env.NEXT_PUBLIC_PROOF_URL ?? "/proof/devnet-latest.json";

export function LiveProofCard({
  onLoadPolicy,
}: {
  onLoadPolicy?: (policy: string, spendMint?: string) => void;
}) {
  const [proof, setProof] = useState<DevnetProof | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(DEFAULT_PROOF_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`No proof at ${DEFAULT_PROOF_URL}`);
        const data = (await res.json()) as DevnetProof;
        if (!cancelled) {
          setProof(data);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setProof(null);
          setError(
            e instanceof Error ? e.message : "Proof file not found (run yarn demo:devnet)"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="border-mint-500/25">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-mint-400" />
              Live proof (devnet)
            </CardTitle>
            <CardDescription>
              Public on-chain run from <code className="text-mist-400">yarn demo:devnet</code>.
            </CardDescription>
          </div>
          {proof && <Badge variant="success">devnet</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading && <p className="text-mist-500">Loading proof…</p>}
        {!loading && error && (
          <p className="text-mist-500">
            {error}. Generate with{" "}
            <code className="text-mist-300">yarn demo:devnet</code>.
          </p>
        )}
        {proof && (
          <>
            <Row
              label="Policy"
              value={
                proof.explorer?.policy ? (
                  <a
                    href={proof.explorer.policy}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-mint-400"
                  >
                    {shortKey(proof.policy, 6)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="font-mono">{shortKey(proof.policy, 6)}</span>
                )
              }
            />
            <Row
              label="Program"
              value={
                <span className="font-mono">{shortKey(proof.programId, 6)}</span>
              }
            />
            <Row
              label="Created"
              value={
                <span className="text-xs text-mist-400">
                  {new Date(proof.createdAt).toLocaleString()}
                </span>
              }
            />
            {proof.signatures?.successSpend && (
              <Row
                label="Success tx"
                value={
                  <a
                    href={
                      proof.explorer?.successTx ??
                      `https://solscan.io/tx/${proof.signatures.successSpend}?cluster=devnet`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-mint-400"
                  >
                    {proof.signatures.successSpend.slice(0, 12)}…
                    <ExternalLink className="h-3 w-3" />
                  </a>
                }
              />
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {proof.rejections?.programNotAllowed && (
                <Badge variant="danger">
                  {proof.rejections.programNotAllowed.title}
                </Badge>
              )}
              {proof.rejections?.destinationNotAllowed && (
                <Badge variant="danger">
                  {proof.rejections.destinationNotAllowed.title}
                </Badge>
              )}
            </div>
            {onLoadPolicy && (
              <Button
                className="w-full"
                size="sm"
                onClick={() => onLoadPolicy(proof.policy, proof.spendMint)}
              >
                Load this policy in control room
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
