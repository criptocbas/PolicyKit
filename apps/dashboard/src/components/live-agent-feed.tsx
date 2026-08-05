"use client";

import { useEffect, useState } from "react";
import {
  assessFreshness,
  freshnessBadgeVariant,
  parseLiveFeed,
  type LiveFeedPayload,
} from "@policykit/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Bot } from "lucide-react";
import Link from "next/link";

type TickEvent = LiveFeedPayload["events"][number];

function badgeVariant(
  e: TickEvent
): "success" | "warn" | "danger" | "muted" {
  if (e.kind.startsWith("reject") || e.kind === "skip_budget") return "warn";
  if (e.ok) return "success";
  return "danger";
}

export function LiveAgentFeed({
  /** When set, only show ticks for this policy (public page). */
  filterPolicy,
  compact,
}: {
  filterPolicy?: string;
  compact?: boolean;
} = {}) {
  const [feed, setFeed] = useState<LiveFeedPayload | null>(null);
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
            "No live feed published yet. From repo root: yarn agent:setup && yarn agent:tick."
          );
        }
        const data: unknown = await res.json();
        const parsed = parseLiveFeed(data);
        if (!parsed.events.length && !parsed.updatedAt) {
          throw new Error(
            "live-feed.json is empty. Run yarn agent:tick to publish allowed + reject samples."
          );
        }
        if (!cancelled) {
          setFeed(parsed);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setFeed(null);
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

  let events = feed?.events ?? [];
  if (filterPolicy && events.length) {
    events = events.filter((e) => {
      if (feed?.policy && feed.policy === filterPolicy) return true;
      const url = e.explorer?.policy ?? "";
      return url.includes(filterPolicy);
    });
  }

  const freshness = assessFreshness(feed?.updatedAt ?? events[0]?.ts);
  const policyPda = feed?.policy ?? null;
  const limit = compact ? 9 : 24;

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
              {freshness.level !== "unknown" && (
                <span className="mt-1 block text-xs text-mist-500">
                  {freshness.detail}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            {feed && (
              <Badge variant={freshnessBadgeVariant(freshness.level)}>
                {freshness.level === "live"
                  ? `Live · ${freshness.label}`
                  : freshness.level === "stale"
                    ? `Stale · ${freshness.label}`
                    : freshness.label}
              </Badge>
            )}
            {events.length > 0 && (
              <Badge variant="muted">{events.length} events</Badge>
            )}
          </div>
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
              After ticks land, this card fills from{" "}
              <code className="text-mist-400">public/proof/live-feed.json</code>
              .
            </p>
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <p className="text-sm text-mist-500">
            {filterPolicy
              ? "No ticks for this policy in the published feed yet."
              : "Feed file is empty. Run yarn agent:tick to publish samples."}
          </p>
        )}
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {events.slice(0, limit).map((e, i) => (
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
        {(policyPda || events.some((e) => e.explorer?.policy)) && (
          <p className="mt-3 text-xs text-mist-500">
            {policyPda ? (
              <>
                <Link
                  href={`/p/${policyPda}`}
                  className="text-mint-400 hover:underline"
                >
                  Public max-damage page
                </Link>
                {" · "}
                <a
                  href={`https://solscan.io/account/${policyPda}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-mint-400 hover:underline"
                >
                  Solscan
                </a>
              </>
            ) : (
              <a
                href={events.find((e) => e.explorer?.policy)?.explorer?.policy}
                target="_blank"
                rel="noreferrer"
                className="text-mint-400 hover:underline"
              >
                Policy on Solscan
              </a>
            )}
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
