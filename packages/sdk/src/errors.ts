/**
 * On-chain PolicyKit custom error codes (Anchor base 6000).
 * Keep in sync with `programs/policykit/src/error.rs` and the IDL.
 */
export const POLICYKIT_ERROR_CODES = {
  PolicyPaused: 6000,
  PolicyExpired: 6001,
  UnauthorizedAuthority: 6002,
  UnauthorizedAgent: 6003,
  ExceedsPerTransactionLimit: 6004,
  ExceedsDailyLimit: 6005,
  RateLimitExceeded: 6006,
  ProgramNotAllowed: 6007,
  ProgramDenied: 6008,
  MintNotAllowed: 6009,
  ZeroAmount: 6010,
  Overflow: 6011,
  ProgramListTooLong: 6012,
  MintListTooLong: 6013,
  EmptyProgramAllowlist: 6014,
  EmptyMintAllowlist: 6015,
  InvalidRateWindow: 6016,
  InvalidExpiry: 6017,
  InsufficientVaultBalance: 6018,
  MintMismatch: 6019,
  InvalidVaultAuthority: 6020,
} as const;

export type PolicyKitErrorName = keyof typeof POLICYKIT_ERROR_CODES;

export const POLICYKIT_ERROR_MESSAGES: Record<PolicyKitErrorName, string> = {
  PolicyPaused: "Policy is paused — the authority must unpause before the agent can spend.",
  PolicyExpired: "Policy has expired — create a new policy or extend expires_at.",
  UnauthorizedAuthority: "Signer is not the policy authority.",
  UnauthorizedAgent: "Signer is not the policy agent — only the configured agent key may spend.",
  ExceedsPerTransactionLimit: "Amount exceeds the per-transaction spend limit.",
  ExceedsDailyLimit: "Amount would exceed the daily spend limit for this policy.",
  RateLimitExceeded: "Rate limit exceeded for this time window — wait for the window to reset.",
  ProgramNotAllowed: "Intent program is not on the policy allowlist.",
  ProgramDenied: "Intent program is on the policy denylist.",
  MintNotAllowed: "Mint is not on the policy mint allowlist.",
  ZeroAmount: "Transfer amount must be greater than zero.",
  Overflow: "Arithmetic overflow while updating policy counters.",
  ProgramListTooLong: "Program list exceeds the maximum length (10).",
  MintListTooLong: "Mint list exceeds the maximum length (10).",
  EmptyProgramAllowlist: "Program allowlist is enabled but empty.",
  EmptyMintAllowlist: "Mint allowlist is enabled but empty.",
  InvalidRateWindow: "Rate limit requires window_seconds > 0.",
  InvalidExpiry: "expires_at must be 0 (never) or a future unix timestamp.",
  InsufficientVaultBalance: "Policy vault does not have enough tokens for this spend.",
  MintMismatch: "Token account mint does not match the expected mint.",
  InvalidVaultAuthority: "Vault token account authority must be the policy PDA.",
};

/** Demo-friendly short titles for pitch / UI. */
export const POLICYKIT_ERROR_TITLES: Record<PolicyKitErrorName, string> = {
  PolicyPaused: "Policy paused",
  PolicyExpired: "Policy expired",
  UnauthorizedAuthority: "Not authority",
  UnauthorizedAgent: "Not agent",
  ExceedsPerTransactionLimit: "Over per-tx limit",
  ExceedsDailyLimit: "Over daily budget",
  RateLimitExceeded: "Rate limited",
  ProgramNotAllowed: "Program not allowed",
  ProgramDenied: "Program denied",
  MintNotAllowed: "Mint not allowed",
  ZeroAmount: "Zero amount",
  Overflow: "Overflow",
  ProgramListTooLong: "Program list too long",
  MintListTooLong: "Mint list too long",
  EmptyProgramAllowlist: "Empty program allowlist",
  EmptyMintAllowlist: "Empty mint allowlist",
  InvalidRateWindow: "Invalid rate window",
  InvalidExpiry: "Invalid expiry",
  InsufficientVaultBalance: "Insufficient vault balance",
  MintMismatch: "Mint mismatch",
  InvalidVaultAuthority: "Invalid vault authority",
};

const CODE_TO_NAME = Object.fromEntries(
  Object.entries(POLICYKIT_ERROR_CODES).map(([name, code]) => [code, name])
) as Record<number, PolicyKitErrorName>;

export interface PolicyKitErrorInfo {
  name: PolicyKitErrorName | "Unknown";
  code: number | null;
  title: string;
  message: string;
  /** True when this is a known on-chain PolicyKit rejection (demo failure path). */
  isPolicyRejection: boolean;
  raw?: unknown;
}

/**
 * Typed error thrown by the SDK when a PolicyKit instruction fails.
 * Catch this in demos/UI to show clean human messages.
 */
export class PolicyKitError extends Error {
  readonly name = "PolicyKitError";
  readonly code: number | null;
  readonly errorName: PolicyKitErrorName | "Unknown";
  readonly title: string;
  readonly isPolicyRejection: boolean;
  readonly raw?: unknown;

  constructor(info: PolicyKitErrorInfo) {
    super(info.message);
    this.code = info.code;
    this.errorName = info.name;
    this.title = info.title;
    this.isPolicyRejection = info.isPolicyRejection;
    this.raw = info.raw;
  }

  toJSON(): PolicyKitErrorInfo {
    return {
      name: this.errorName,
      code: this.code,
      title: this.title,
      message: this.message,
      isPolicyRejection: this.isPolicyRejection,
    };
  }
}

/**
 * Map any thrown value (AnchorError, SendTransactionError, plain Error)
 * into a structured PolicyKit error for demos and agents.
 */
export function mapPolicyKitError(err: unknown): PolicyKitErrorInfo {
  const parsed = extractAnchorError(err);
  if (parsed) {
    const name = CODE_TO_NAME[parsed.code] ?? (parsed.name as PolicyKitErrorName | undefined);
    if (name && name in POLICYKIT_ERROR_MESSAGES) {
      return {
        name,
        code: POLICYKIT_ERROR_CODES[name],
        title: POLICYKIT_ERROR_TITLES[name],
        message: POLICYKIT_ERROR_MESSAGES[name],
        isPolicyRejection: true,
        raw: err,
      };
    }
    if (parsed.code != null && CODE_TO_NAME[parsed.code]) {
      const n = CODE_TO_NAME[parsed.code];
      return {
        name: n,
        code: parsed.code,
        title: POLICYKIT_ERROR_TITLES[n],
        message: POLICYKIT_ERROR_MESSAGES[n],
        isPolicyRejection: true,
        raw: err,
      };
    }
  }

  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Unknown error";

  // Fallback: scan message for known error names
  for (const name of Object.keys(POLICYKIT_ERROR_MESSAGES) as PolicyKitErrorName[]) {
    if (msg.includes(name) || msg.includes(POLICYKIT_ERROR_MESSAGES[name])) {
      return {
        name,
        code: POLICYKIT_ERROR_CODES[name],
        title: POLICYKIT_ERROR_TITLES[name],
        message: POLICYKIT_ERROR_MESSAGES[name],
        isPolicyRejection: true,
        raw: err,
      };
    }
  }

  return {
    name: "Unknown",
    code: null,
    title: "Transaction failed",
    message: msg,
    isPolicyRejection: false,
    raw: err,
  };
}

export function toPolicyKitError(err: unknown): PolicyKitError {
  if (err instanceof PolicyKitError) return err;
  return new PolicyKitError(mapPolicyKitError(err));
}

function extractAnchorError(
  err: unknown
): { code: number; name?: string } | null {
  if (!err || typeof err !== "object") return null;
  const e = err as Record<string, any>;

  // @coral-xyz/anchor AnchorError
  if (e.error?.errorCode) {
    const code = Number(e.error.errorCode.number ?? e.error.errorCode.code);
    const name = e.error.errorCode.code as string | undefined;
    if (!Number.isNaN(code)) return { code, name };
  }

  if (typeof e.code === "number") {
    return { code: e.code, name: e.errorName ?? e.name };
  }

  // logs: "Error Code: ExceedsDailyLimit. Error Number: 6005."
  const logs: string[] = e.logs ?? e.error?.logs ?? [];
  const joined = Array.isArray(logs) ? logs.join("\n") : String(e.message ?? "");
  const numMatch = joined.match(/Error Number:\s*(\d+)/);
  const nameMatch = joined.match(/Error Code:\s*(\w+)/);
  if (numMatch) {
    return { code: Number(numMatch[1]), name: nameMatch?.[1] };
  }
  if (nameMatch && nameMatch[1] in POLICYKIT_ERROR_CODES) {
    const name = nameMatch[1] as PolicyKitErrorName;
    return { code: POLICYKIT_ERROR_CODES[name], name };
  }

  return null;
}
