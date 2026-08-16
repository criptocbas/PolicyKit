import { expect } from "chai";
import * as sdk from "../src";

describe("public SDK compatibility surface", () => {
  it("exports the stable client, safety, proof, template, and x402 APIs", () => {
    const required = [
      "PolicyKitClient",
      "POLICYKIT_PROGRAM_ID",
      "findPolicyPda",
      "findVaultAta",
      "previewSpend",
      "computeMaxDamage",
      "assessPolicySafety",
      "conservativeTradingTemplate",
      "x402PaymentsTemplate",
      "parseLiveFeed",
      "validatePolicyKitX402Payment",
      "createPolicyKitX402PaymentHeader",
    ];
    for (const name of required) {
      expect(sdk, `missing public export ${name}`).to.have.property(name);
    }
  });
});
