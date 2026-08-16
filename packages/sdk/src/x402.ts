import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";

export const X402_VERSION = 2;
export const POLICYKIT_X402_SCHEME = "policykit-exact";
export const SOLANA_CAIP2 = {
  mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
} as const;

export interface X402Resource {
  url: string;
  description?: string;
  mimeType?: string;
}

export interface X402PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

export interface X402PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: X402Resource;
  accepts: X402PaymentRequirements[];
  extensions?: Record<string, unknown>;
}

export interface PolicyKitX402Constraints {
  network: string;
  asset: PublicKey;
  maxAmount: BN | number | bigint | string;
  allowedPayTo: PublicKey[];
  /** Declared PolicyKit intent expected in requirement.extra.intentProgram. */
  intentProgram: PublicKey;
  maxTimeoutSeconds?: number;
}

export interface ValidatedPolicyKitX402Payment {
  paymentRequired: X402PaymentRequired;
  accepted: X402PaymentRequirements;
  amount: BN;
  asset: PublicKey;
  payTo: PublicKey;
  intentProgram: PublicKey;
}

export type X402ValidationErrorCode =
  | "MISSING_PAYMENT_REQUIRED"
  | "INVALID_ENCODING"
  | "INVALID_SCHEMA"
  | "NO_ACCEPTABLE_PAYMENT"
  | "AMOUNT_EXCEEDS_LIMIT";

export class X402ValidationError extends Error {
  readonly name = "X402ValidationError";

  constructor(readonly code: X402ValidationErrorCode, message: string) {
    super(message);
  }
}

/**
 * Parse an x402 v2 PAYMENT-REQUIRED header and select a PolicyKit-compatible
 * custom scheme. Every economic field is matched exactly before a signer or
 * PolicyKit client is invoked.
 */
export function validatePolicyKitX402Payment(
  paymentRequiredHeader: string | null | undefined,
  constraints: PolicyKitX402Constraints
): ValidatedPolicyKitX402Payment {
  if (!paymentRequiredHeader) {
    throw new X402ValidationError(
      "MISSING_PAYMENT_REQUIRED",
      "Response did not include a PAYMENT-REQUIRED header."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Utf8(paymentRequiredHeader));
  } catch {
    throw new X402ValidationError(
      "INVALID_ENCODING",
      "PAYMENT-REQUIRED is not valid base64-encoded JSON."
    );
  }
  if (!isPaymentRequired(parsed)) {
    throw new X402ValidationError(
      "INVALID_SCHEMA",
      "PAYMENT-REQUIRED does not match the x402 v2 schema."
    );
  }

  const maxAmount = toBn(constraints.maxAmount);
  let excessiveAmount = false;
  for (const option of parsed.accepts) {
    if (
      option.scheme !== POLICYKIT_X402_SCHEME ||
      option.network !== constraints.network ||
      option.asset !== constraints.asset.toBase58()
    ) {
      continue;
    }

    let amount: BN;
    let payTo: PublicKey;
    let intentProgram: PublicKey;
    try {
      amount = new BN(option.amount, 10);
      payTo = new PublicKey(option.payTo);
      intentProgram = new PublicKey(String(option.extra?.intentProgram ?? ""));
    } catch {
      continue;
    }
    if (amount.lte(new BN(0))) continue;
    if (amount.gt(maxAmount)) {
      excessiveAmount = true;
      continue;
    }
    if (!constraints.allowedPayTo.some((key) => key.equals(payTo))) continue;
    if (!constraints.intentProgram.equals(intentProgram)) continue;
    if (
      !Number.isInteger(option.maxTimeoutSeconds) ||
      option.maxTimeoutSeconds <= 0 ||
      (constraints.maxTimeoutSeconds !== undefined &&
        option.maxTimeoutSeconds > constraints.maxTimeoutSeconds)
    ) {
      continue;
    }

    return {
      paymentRequired: parsed,
      accepted: option,
      amount,
      asset: constraints.asset,
      payTo,
      intentProgram,
    };
  }

  if (excessiveAmount) {
    throw new X402ValidationError(
      "AMOUNT_EXCEEDS_LIMIT",
      "The x402 payment amount exceeds the caller's maximum."
    );
  }
  throw new X402ValidationError(
    "NO_ACCEPTABLE_PAYMENT",
    "No payment option matches the required network, asset, recipient, intent, and timeout."
  );
}

/**
 * Build the custom scheme payload sent in PAYMENT-SIGNATURE after PolicyKit has
 * settled the transfer. This is not the standard Solana `exact` transaction
 * payload; servers must explicitly support `policykit-exact`.
 */
export function createPolicyKitX402PaymentHeader(args: {
  validated: ValidatedPolicyKitX402Payment;
  signature: string;
  policy: PublicKey;
}): string {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(args.signature)) {
    throw new X402ValidationError(
      "INVALID_SCHEMA",
      "Settlement signature is not valid base58 transaction data."
    );
  }
  return encodeBase64Utf8(
    JSON.stringify({
      x402Version: X402_VERSION,
      resource: args.validated.paymentRequired.resource,
      accepted: args.validated.accepted,
      payload: {
        signature: args.signature,
        policy: args.policy.toBase58(),
      },
    })
  );
}

export function encodeX402PaymentRequired(
  paymentRequired: X402PaymentRequired
): string {
  if (!isPaymentRequired(paymentRequired)) {
    throw new X402ValidationError(
      "INVALID_SCHEMA",
      "Payment-required value does not match the x402 v2 schema."
    );
  }
  return encodeBase64Utf8(JSON.stringify(paymentRequired));
}

function isPaymentRequired(value: unknown): value is X402PaymentRequired {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (
    item.x402Version !== X402_VERSION ||
    !item.resource ||
    typeof item.resource !== "object" ||
    !Array.isArray(item.accepts)
  ) {
    return false;
  }
  const resource = item.resource as Record<string, unknown>;
  if (typeof resource.url !== "string" || resource.url.length === 0)
    return false;
  return item.accepts.every((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const option = raw as Record<string, unknown>;
    return (
      typeof option.scheme === "string" &&
      typeof option.network === "string" &&
      typeof option.amount === "string" &&
      /^\d+$/.test(option.amount) &&
      typeof option.asset === "string" &&
      typeof option.payTo === "string" &&
      typeof option.maxTimeoutSeconds === "number"
    );
  });
}

function toBn(value: BN | number | bigint | string): BN {
  if (BN.isBN(value)) return value;
  return new BN(value.toString(), 10);
}

function decodeBase64Utf8(value: string): string {
  const runtime = globalThis as unknown as {
    atob?: (input: string) => string;
    Buffer?: {
      from(
        input: string,
        encoding: string
      ): { toString(encoding: string): string };
    };
  };
  if (runtime.Buffer)
    return runtime.Buffer.from(value, "base64").toString("utf8");
  if (!runtime.atob) throw new Error("No base64 decoder is available.");
  const binary = runtime.atob(value);
  const escaped = Array.from(
    binary,
    (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
  ).join("");
  return decodeURIComponent(escaped);
}

function encodeBase64Utf8(value: string): string {
  const runtime = globalThis as unknown as {
    btoa?: (input: string) => string;
    Buffer?: {
      from(
        input: string,
        encoding: string
      ): { toString(encoding: string): string };
    };
  };
  if (runtime.Buffer)
    return runtime.Buffer.from(value, "utf8").toString("base64");
  if (!runtime.btoa) throw new Error("No base64 encoder is available.");
  const binary = encodeURIComponent(value).replace(
    /%([0-9A-F]{2})/g,
    (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))
  );
  return runtime.btoa(binary);
}
