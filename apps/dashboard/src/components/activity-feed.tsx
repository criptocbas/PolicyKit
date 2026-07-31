"use client";

import { ActivityItem } from "@/lib/activity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { solscanTx } from "@/lib/solscan";
import { ExternalLink, RefreshCw } from "lucide-react";
import { formatTs } from "@/lib/format";

export function ActivityFeed({
  items,
  onRefreshChain,
  refreshing,
}: {
  items: ActivityItem[];
  onRefreshChain?: () => void;
  refreshing?: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Activity</CardTitle>
            <CardDescription>
              Local session + on-chain history for the active policy.
            </CardDescription>
          </div>
          {onRefreshChain && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefreshChain}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Chain
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-mist-500">
            No activity yet. Create a policy, run the agent demo, or refresh from chain.
          </p>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-ink-600/70 bg-ink-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-mist-100">
                      {item.title}
                    </p>
                    {item.detail && (
                      <p className="mt-0.5 text-xs text-mist-400">{item.detail}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-[11px] text-mist-500">
                        {formatTs(item.ts)}
                      </p>
                      <Badge variant="muted" className="text-[10px]">
                        {item.source === "chain" ? "On-chain" : "Local"}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant={item.success ? "success" : "danger"}>
                    {item.success ? "ok" : "fail"}
                  </Badge>
                </div>
                {item.signature && (
                  <a
                    href={solscanTx(item.signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-mint-400 hover:text-mint-300"
                  >
                    {item.signature.slice(0, 12)}…
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
