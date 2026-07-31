"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Bot } from "lucide-react";

type TickEvent = {
  ts: string;
  kind: string;
  ok: boolean;
  errorName?: string;
  errorTitle?: string;
  signature?: string;
  remainingDaily?: string | null;
  message?: string;
  explorer?: { tx?: string; policy?: string };
};

export function LiveAgentFeed() {
  const [events, setEvents] = useState<TickEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/proof/live-feed.json", { cache: "no-store" });
        if (!res.ok) throw new Error("No live feed yet (run yarn agent:setup && yarn agent:tick)");
        const data = (await res.json()) as TickEvent[];
        if (!cancelled) {
          setEvents(data);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Feed unavailable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="border-mint-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-mint-400" />
          Live adversary ticks
        </CardTitle>
        <CardDescription>
          Public agent: allowed spend + rogue program + rogue destination.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-mist-500">{error}</p>}
        {!error && events.length === 0 && (
          <p className="text-sm text-mist-500">No ticks yet.</p>
        )}
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {events.slice(0, 24).map((e, i) => (
            <li
              key={`${e.ts}-${i}`}
              className="rounded-lg border border-ink-600/70 bg-ink-950/40 p-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-mist-100">
                    {e.message ?? e.kind}
                  </p>
                  <p className="text-[11px] text-mist-500">
                    {new Date(e.ts).toLocaleString()}
                  </p>
                </div>
                <Badge variant={e.ok ? (e.kind.startsWith("reject") || e.kind === "skip_budget" ? "warn" : "success") : "danger"}>
                  {e.kind}
                </Badge>
              </div>
              {e.explorer?.tx && (
                <a
                  href={e.explorer.tx}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-mint-400"
                >
                  Solscan
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
