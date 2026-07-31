"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { StoredPolicy } from "@/lib/policies-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { shortKey } from "@/lib/format";
import { solscanAddress } from "@/lib/solscan";
import { ExternalLink, Layers } from "lucide-react";

export function PolicySwitcher({
  policies,
  active,
  onSelect,
  onLoadAddress,
  onRemove,
}: {
  policies: StoredPolicy[];
  active: string | null;
  onSelect: (address: string) => void;
  onLoadAddress: (address: string) => void;
  onRemove?: (address: string) => void;
}) {
  const [raw, setRaw] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-mint-400" />
          Policies
        </CardTitle>
        <CardDescription>
          Switch between policies created in this browser or load by PDA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {policies.length === 0 ? (
          <p className="text-sm text-mist-500">
            No saved policies yet. Create one below.
          </p>
        ) : (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto">
            {policies.map((p) => {
              const selected = p.address === active;
              return (
                <li key={p.address}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.address)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      selected
                        ? "border-mint-500/40 bg-mint-500/10"
                        : "border-ink-600 bg-ink-950/40 hover:border-mist-500/30"
                    }`}
                  >
                    <span>
                      <span className="font-mono text-mist-100">
                        {shortKey(p.address, 5)}
                      </span>
                      {p.label && (
                        <span className="ml-2 text-xs text-mist-500">
                          {p.label}
                        </span>
                      )}
                      {p.policyId > 0 && (
                        <span className="ml-1 text-[11px] text-mist-500">
                          #{p.policyId}
                        </span>
                      )}
                    </span>
                    {selected && <Badge variant="success">active</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {active && (
          <a
            href={solscanAddress(active)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-mint-400 hover:text-mint-300"
          >
            Active {shortKey(active, 6)}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        <div className="space-y-1.5 border-t border-ink-700 pt-3">
          <Label>Load policy PDA</Label>
          <div className="flex gap-2">
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Policy address"
              onKeyDown={(e) => {
                if (e.key === "Enter" && raw.trim()) {
                  try {
                    new PublicKey(raw.trim());
                    onLoadAddress(raw.trim());
                    setRaw("");
                  } catch {
                    /* parent shows error */
                    onLoadAddress(raw.trim());
                  }
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!raw.trim()}
              onClick={() => {
                onLoadAddress(raw.trim());
                setRaw("");
              }}
            >
              Load
            </Button>
          </div>
        </div>

        {active && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="text-mist-500"
            onClick={() => onRemove(active)}
          >
            Remove active from list
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
