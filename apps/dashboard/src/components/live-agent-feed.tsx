"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Bot } from "lucide-react";
import Link from "next/link";

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

function badgeVariant(
  e: TickEvent
): "success" | "warn" | "danger" | "muted" {
  if (e.kind.startsWith("reject") || e.kind === "skip_budget") return "warn";
  if (e.ok) return "success";
  return "danger";
}

export function LiveAgentFeed() {
  const [events, setEvents] = useState<TickEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/proof/live-feed.json", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(
            "No live feed published yet. From repo root: yarn agent:setup && yarn agent:tick (see scripts/live-agent/README.md)."
          );
        }
        const data: unknown = await res.json();
        const list = Array.isArray(data)
          ? (data as TickEvent[])
          : Array.isArray((data as { events?: TickEvent[] })?.events)
            ? (data as { events: TickEvent[] }).events
            : null;
        if (!list) {
          throw new Error(
            "live-feed.json has unexpected shape (expected a tick array)."
          );
        }
        if (!cancelled) {
          setEvents(list);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setEvents([]);
          setError(e instanceof Error ? e.message : "Feed unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const policyFromFeed = events.find((e) => e.explorer?.policy)?.explorer
    ?.policy;

  return (
    <Card className="border-mint-500/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-mint-400" />
              Live adversary ticks
            </CardTitle>
            <CardDescription>
              Public agent: allowed spend + rogue program + rogue destination.
            </CardDescription>
          </div>
          {events.length > 0 && (
            <Badge variant="success">{events.length} ticks</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <p className="text-sm text-mist-500">Loading adversary feed…</p>
        )}
        {!loading && error && (
          <div className="space-y-2 text-sm text-mist-500">
            <p>{error}</p>
            <p className="text-xs text-mist-600">
              After ticks land, this card auto-fills from{" "}
              <code className="text-mist-400">public/proof/live-feed.json</code>
              .
            </p>
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <p className="text-sm text-mist-500">
            Feed file is empty. Run{" "}
            <code className="text-mist-300">yarn agent:tick</code> to publish
            allowed + reject samples.
          </p>
        )}
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {events.slice(0, 24).map((e, i) => (
            <li
              key={`${e.ts}-${i}`}
              className="rounded-lg border border-ink-600/70 bg-ink-950/40 p-2.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-mist-100">
                    {e.message ?? e.errorTitle ?? e.kind}
                  </p>
                  <p className="text-[11px] text-mist-500">
                    {e.ts ? new Date(e.ts).toLocaleString() : "—"}
                  </p>
                </div>
                <Badge variant={badgeVariant(e)}>{e.kind}</Badge>
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
        {policyFromFeed && (
          <p className="mt-3 text-xs text-mist-500">
            <a
              href={policyFromFeed}
              target="_blank"
              rel="noreferrer"
              className="text-mint-400 hover:underline"
            >
              Policy on Solscan
            </a>
            {" · "}
            <Link href="/" className="text-mint-400 hover:underline">
              Control room
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
