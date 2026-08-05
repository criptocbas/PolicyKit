/**
 * Human-readable freshness for public proof artifacts (live feed / one-shot demo).
 * Pure helpers — safe for unit tests and client components.
 */

export type FreshnessLevel = "live" | "recent" | "stale" | "unknown";

export type Freshness = {
  level: FreshnessLevel;
  /** Short label for badges, e.g. "12m ago" or "5d ago" */
  label: string;
  /** Longer sentence for descriptions */
  detail: string;
};

/** Thresholds (ms). Tuned for a demo product: hourly ticks stay "live". */
export const FRESHNESS_MS = {
  live: 6 * 60 * 60 * 1000, // < 6h
  recent: 48 * 60 * 60 * 1000, // < 48h
} as const;

export function formatRelativeAge(
  thenMs: number,
  nowMs: number = Date.now()
): string {
  const delta = Math.max(0, nowMs - thenMs);
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function assessFreshness(
  isoOrMs: string | number | null | undefined,
  nowMs: number = Date.now()
): Freshness {
  if (isoOrMs === null || isoOrMs === undefined || isoOrMs === "") {
    return {
      level: "unknown",
      label: "unknown",
      detail: "No timestamp published yet.",
    };
  }
  const then =
    typeof isoOrMs === "number" ? isoOrMs : Date.parse(String(isoOrMs));
  if (!Number.isFinite(then)) {
    return {
      level: "unknown",
      label: "unknown",
      detail: "Timestamp could not be parsed.",
    };
  }
  const age = Math.max(0, nowMs - then);
  const label = formatRelativeAge(then, nowMs);
  if (age <= FRESHNESS_MS.live) {
    return {
      level: "live",
      label,
      detail: `Last update ${label} — adversary loop is current.`,
    };
  }
  if (age <= FRESHNESS_MS.recent) {
    return {
      level: "recent",
      label,
      detail: `Last update ${label}. Run yarn agent:tick to refresh.`,
    };
  }
  return {
    level: "stale",
    label,
    detail: `Last update ${label} — feed is stale. Run yarn agent:tick from the repo.`,
  };
}

export function freshnessBadgeVariant(
  level: FreshnessLevel
): "success" | "warn" | "danger" | "muted" {
  switch (level) {
    case "live":
      return "success";
    case "recent":
      return "warn";
    case "stale":
      return "danger";
    default:
      return "muted";
  }
}

/** Normalize live-feed.json: array (legacy) or { events, updatedAt, ... }. */
export type LiveFeedPayload = {
  updatedAt: string | null;
  policy: string | null;
  cluster: string | null;
  events: Array<{
    ts: string;
    kind: string;
    ok: boolean;
    errorName?: string;
    errorTitle?: string;
    signature?: string;
    remainingDaily?: string | null;
    message?: string;
    explorer?: { tx?: string; policy?: string };
  }>;
};

export function parseLiveFeed(data: unknown): LiveFeedPayload {
  if (Array.isArray(data)) {
    const events = data as LiveFeedPayload["events"];
    const updatedAt = events[0]?.ts ?? null;
    const policyUrl = events.find((e) => e.explorer?.policy)?.explorer?.policy;
    return {
      updatedAt,
      policy: policyFromExplorer(policyUrl) ?? null,
      cluster: "devnet",
      events,
    };
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const events = Array.isArray(o.events)
      ? (o.events as LiveFeedPayload["events"])
      : [];
    const updatedAt =
      typeof o.updatedAt === "string"
        ? o.updatedAt
        : events[0]?.ts ?? null;
    const policy =
      typeof o.policy === "string" && !o.policy.startsWith("http")
        ? o.policy
        : policyFromExplorer(
            typeof o.policy === "string" ? o.policy : undefined
          ) ??
          policyFromExplorer(
            events.find((e) => e.explorer?.policy)?.explorer?.policy
          ) ??
          null;
    return {
      updatedAt,
      policy,
      cluster: typeof o.cluster === "string" ? o.cluster : "devnet",
      events,
    };
  }
  return { updatedAt: null, policy: null, cluster: null, events: [] };
}

function policyFromExplorer(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
  return m ? m[1] : null;
}
