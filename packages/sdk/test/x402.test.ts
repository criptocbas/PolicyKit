import { expect } from "chai";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import {
  POLICYKIT_X402_SCHEME,
  SOLANA_CAIP2,
  X402ValidationError,
  createPolicyKitX402PaymentHeader,
  encodeX402PaymentRequired,
  validatePolicyKitX402Payment,
  type X402PaymentRequired,
} from "../src/x402";

const ASSET = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const PAY_TO = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const INTENT = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
const POLICY = new PublicKey("GG9quehB9FZEexttoxanCxapSFMHxDhZ5gGV6wsHe66n");

function paymentRequired(
  overrides: Partial<X402PaymentRequired["accepts"][number]> = {}
): X402PaymentRequired {
  return {
    x402Version: 2,
    resource: {
      url: "http://127.0.0.1:3402/research",
      description: "Bounded research result",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: POLICYKIT_X402_SCHEME,
        network: SOLANA_CAIP2.devnet,
        amount: "1000000",
        asset: ASSET.toBase58(),
        payTo: PAY_TO.toBase58(),
        maxTimeoutSeconds: 60,
        extra: { intentProgram: INTENT.toBase58() },
        ...overrides,
      },
    ],
    extensions: {},
  };
}

const constraints = {
  network: SOLANA_CAIP2.devnet,
  asset: ASSET,
  maxAmount: new BN(2_000_000),
  allowedPayTo: [PAY_TO],
  intentProgram: INTENT,
  maxTimeoutSeconds: 120,
};

describe("PolicyKit x402 adapter", () => {
  it("validates every economic field before selecting a payment", () => {
    const required = paymentRequired();
    const result = validatePolicyKitX402Payment(
      encodeX402PaymentRequired(required),
      constraints
    );
    expect(result.amount.toString()).to.equal("1000000");
    expect(result.payTo.equals(PAY_TO)).to.equal(true);
    expect(result.intentProgram.equals(INTENT)).to.equal(true);
  });

  it("rejects an excessive quoted amount", () => {
    expect(() =>
      validatePolicyKitX402Payment(
        encodeX402PaymentRequired(paymentRequired({ amount: "3000000" })),
        constraints
      )
    ).to.throw(X402ValidationError, "exceeds");
  });

  it("rejects wrong recipient, mint, network, intent, and timeout", () => {
    const wrong = PublicKey.default.toBase58();
    const cases: Partial<X402PaymentRequired["accepts"][number]>[] = [
      { payTo: wrong },
      { asset: wrong },
      { network: SOLANA_CAIP2.mainnet },
      { extra: { intentProgram: wrong } },
      { maxTimeoutSeconds: 121 },
    ];
    for (const override of cases) {
      expect(() =>
        validatePolicyKitX402Payment(
          encodeX402PaymentRequired(paymentRequired(override)),
          constraints
        )
      ).to.throw(X402ValidationError, "No payment option");
    }
  });

  it("rejects malformed and missing PAYMENT-REQUIRED headers", () => {
    expect(() => validatePolicyKitX402Payment(null, constraints)).to.throw(
      "did not include"
    );
    expect(() =>
      validatePolicyKitX402Payment("not-base64", constraints)
    ).to.throw("base64-encoded JSON");
  });

  it("creates a scheme-specific PAYMENT-SIGNATURE payload", () => {
    const validated = validatePolicyKitX402Payment(
      encodeX402PaymentRequired(paymentRequired()),
      constraints
    );
    const header = createPolicyKitX402PaymentHeader({
      validated,
      signature: "1".repeat(64),
      policy: POLICY,
    });
    const payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    expect(payload.x402Version).to.equal(2);
    expect(payload.accepted.scheme).to.equal(POLICYKIT_X402_SCHEME);
    expect(payload.payload.signature).to.equal("1".repeat(64));
    expect(payload.payload.policy).to.equal(POLICY.toBase58());
  });
});
