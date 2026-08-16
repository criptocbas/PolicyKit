import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import { assessPolicySafety } from "../src/safety-assessment";
import {
  POLICY_TEMPLATES,
  POLICY_TEMPLATE_METADATA,
  type PolicyTemplateName,
} from "../src/templates";

const AGENT = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

describe("policy templates", () => {
  for (const name of Object.keys(POLICY_TEMPLATES) as PolicyTemplateName[]) {
    it(`${name} is bounded by default and has versioned metadata`, () => {
      const params = POLICY_TEMPLATES[name]({
        agent: AGENT,
        spendMint: MINT,
        destinationOwners: [AGENT],
      });
      expect(assessPolicySafety(params).level).to.equal("bounded");
      expect(POLICY_TEMPLATE_METADATA[name].version).to.equal(1);
      expect(POLICY_TEMPLATE_METADATA[name].assumptions).not.to.be.empty;
    });
  }

  it("classifies an explicitly open destination override as partially bounded", () => {
    const params = POLICY_TEMPLATES.x402Payments({
      agent: AGENT,
      spendMint: MINT,
      destinationAllowlistEnabled: false,
    });
    expect(assessPolicySafety(params).level).to.equal("partially-bounded");
  });

  it("rejects unsupported token decimal values", () => {
    expect(() =>
      POLICY_TEMPLATES.conservativeTrading({
        agent: AGENT,
        spendMint: MINT,
        decimals: 19,
      })
    ).to.throw("Token decimals");
  });
});
