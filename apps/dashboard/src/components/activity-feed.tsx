"use client";

import { ActivityItem } from "@/lib/activity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { solscanTx } from "@/lib/solscan";
import { ExternalLink } from "lucide-react";
import { formatTs } from "@/lib/format";

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>
          Recent dashboard actions with explorer links.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-mist-500">
            No activity yet. Create a policy or run the agent demo.
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
                    <p className="mt-1 text-[11px] text-mist-500">
                      {formatTs(item.ts)}
                    </p>
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
