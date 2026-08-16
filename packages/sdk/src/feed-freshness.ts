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

export type LiveFeedEvidence =
  | "onchain_success"
  | "onchain_rejection"
  | "preflight_rejection"
  | "local_observation";

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
  version: number;
  updatedAt: string | null;
  policy: string | null;
  cluster: string | null;
  programId: string | null;
  valid: boolean;
  issues: string[];
  events: Array<{
    ts: string;
    kind: string;
    ok: boolean;
    evidence?: LiveFeedEvidence;
    errorName?: string;
    errorTitle?: string;
    signature?: string;
    slot?: number;
    blockTime?: number | null;
    remainingDaily?: string | null;
    message?: string;
    explorer?: { tx?: string; policy?: string };
  }>;
};

export function parseLiveFeed(
  data: unknown,
  nowMs: number = Date.now()
): LiveFeedPayload {
  if (Array.isArray(data)) {
    const events = normalizeEvents(data);
    const updatedAt = events[0]?.ts ?? null;
    const policyUrl = events.find((e) => e.explorer?.policy)?.explorer?.policy;
    return {
      version: 0,
      updatedAt,
      policy: policyFromExplorer(policyUrl) ?? null,
      cluster: "devnet",
      programId: null,
      valid: true,
      issues: ["Legacy unversioned feed; evidence classes were inferred."],
      events,
    };
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const events = Array.isArray(o.events) ? normalizeEvents(o.events) : [];
    const version = typeof o.version === "number" ? o.version : 1;
    const updatedAt =
      typeof o.updatedAt === "string" ? o.updatedAt : events[0]?.ts ?? null;
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
    const issues = validateFeed(
      version,
      updatedAt,
      policy,
      typeof o.programId === "string" ? o.programId : null,
      events,
      nowMs
    );
    return {
      version,
      updatedAt,
      policy,
      cluster: typeof o.cluster === "string" ? o.cluster : "devnet",
      programId: typeof o.programId === "string" ? o.programId : null,
      valid: issues.length === 0,
      issues,
      events,
    };
  }
  return {
    version: 0,
    updatedAt: null,
    policy: null,
    cluster: null,
    programId: null,
    valid: false,
    issues: ["Feed payload is not an object or array."],
    events: [],
  };
}

function normalizeEvents(data: unknown[]): LiveFeedPayload["events"] {
  return data
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object"
    )
    .map((item) => {
      const signature =
        typeof item.signature === "string" ? item.signature : undefined;
      const kind = typeof item.kind === "string" ? item.kind : "invalid";
      const evidence =
        typeof item.evidence === "string"
          ? (item.evidence as LiveFeedEvidence)
          : signature
          ? "onchain_success"
          : kind.startsWith("reject")
          ? "preflight_rejection"
          : "local_observation";
      return {
        ts: typeof item.ts === "string" ? item.ts : "",
        kind,
        ok: item.ok === true,
        evidence,
        errorName:
          typeof item.errorName === "string" ? item.errorName : undefined,
        errorTitle:
          typeof item.errorTitle === "string" ? item.errorTitle : undefined,
        signature,
        slot: typeof item.slot === "number" ? item.slot : undefined,
        blockTime:
          typeof item.blockTime === "number" || item.blockTime === null
            ? item.blockTime
            : undefined,
        remainingDaily:
          typeof item.remainingDaily === "string" ||
          item.remainingDaily === null
            ? item.remainingDaily
            : undefined,
        message: typeof item.message === "string" ? item.message : undefined,
        explorer:
          item.explorer && typeof item.explorer === "object"
            ? (item.explorer as { tx?: string; policy?: string })
            : undefined,
      };
    });
}

function validateFeed(
  version: number,
  updatedAt: string | null,
  policy: string | null,
  programId: string | null,
  events: LiveFeedPayload["events"],
  nowMs: number
): string[] {
  const issues: string[] = [];
  if (version !== 1 && version !== 2) {
    issues.push(`Unsupported feed version: ${version}.`);
  }
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) {
    issues.push("updatedAt must be a valid ISO-8601 timestamp.");
  } else if (Date.parse(updatedAt) > nowMs + 5 * 60_000) {
    issues.push("updatedAt is more than five minutes in the future.");
  }
  if (!policy || !isBase58Address(policy)) {
    issues.push("policy must be a base58 public key.");
  }
  if (version >= 2 && (!programId || !isBase58Address(programId))) {
    issues.push("programId must be a base58 public key for feed version 2.");
  }
  events.forEach((event, index) => {
    if (!event.ts || !Number.isFinite(Date.parse(event.ts))) {
      issues.push(`events[${index}].ts is invalid.`);
    } else if (Date.parse(event.ts) > nowMs + 5 * 60_000) {
      issues.push(
        `events[${index}].ts is more than five minutes in the future.`
      );
    }
    if (
      version >= 2 &&
      (event.evidence === "onchain_success" ||
        event.evidence === "onchain_rejection") &&
      !event.signature
    ) {
      issues.push(
        `events[${index}] claims ${event.evidence} without a transaction signature.`
      );
    }
    if (
      event.signature &&
      !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(event.signature)
    ) {
      issues.push(
        `events[${index}].signature is not valid base58 transaction data.`
      );
    }
  });
  return issues;
}

function isBase58Address(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function policyFromExplorer(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/);
  return m ? m[1] : null;
}
