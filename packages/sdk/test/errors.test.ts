import { expect } from "chai";
import {
  POLICYKIT_ERROR_CODES,
  POLICYKIT_ERROR_MESSAGES,
  POLICYKIT_ERROR_TITLES,
  mapPolicyKitError,
  type PolicyKitErrorName,
} from "../src/errors";

describe("POLICYKIT_ERROR_CODES catalog", () => {
  it("covers every code from 6000 through 6026 exactly once", () => {
    const codes = Object.values(POLICYKIT_ERROR_CODES);
    expect(codes).to.have.length(27);
    for (let c = 6000; c <= 6026; c++) {
      expect(codes).to.include(c, `missing code ${c}`);
    }
    const unique = new Set(codes);
    expect(unique.size).to.equal(27);
  });

  it("has a message and title for every named error", () => {
    for (const name of Object.keys(POLICYKIT_ERROR_CODES) as PolicyKitErrorName[]) {
      expect(POLICYKIT_ERROR_MESSAGES[name], `message for ${name}`).to.be.a("string")
        .and.not.empty;
      expect(POLICYKIT_ERROR_TITLES[name], `title for ${name}`).to.be.a("string").and
        .not.empty;
    }
  });

  it("includes pitch-demo titles", () => {
    const titles = Object.values(POLICYKIT_ERROR_TITLES);
    expect(titles).to.include("Over daily budget");
    expect(titles).to.include("Program not allowed");
    expect(titles).to.include("Rate limited");
    expect(titles).to.include("Policy paused");
    expect(titles).to.include("Policy expired");
    expect(titles).to.include("Not agent");
    expect(titles).to.include("Over per-tx limit");
    expect(titles).to.include("Destination not allowed");
  });
});

describe("mapPolicyKitError", () => {
  it("maps Anchor-like error by code number", () => {
    const err = {
      error: {
        errorCode: {
          number: 6005,
          code: "ExceedsDailyLimit",
        },
      },
    };
    const info = mapPolicyKitError(err);
    expect(info.name).to.equal("ExceedsDailyLimit");
    expect(info.code).to.equal(6005);
    expect(info.title).to.equal("Over daily budget");
    expect(info.isPolicyRejection).to.equal(true);
  });

  it("maps from logs Error Number / Error Code", () => {
    const err = {
      logs: [
        "Program log: AnchorError thrown in programs/policykit/src/state/policy.rs",
        "Error Code: ProgramNotAllowed. Error Number: 6007. Error Message: Intent program is not on the allowlist.",
      ],
    };
    const info = mapPolicyKitError(err);
    expect(info.name).to.equal("ProgramNotAllowed");
    expect(info.code).to.equal(6007);
    expect(info.title).to.equal("Program not allowed");
  });

  it("maps every catalog code via synthetic code field", () => {
    for (const [name, code] of Object.entries(POLICYKIT_ERROR_CODES) as [
      PolicyKitErrorName,
      number,
    ][]) {
      const info = mapPolicyKitError({ code, errorName: name });
      expect(info.name).to.equal(name);
      expect(info.code).to.equal(code);
      expect(info.title).to.equal(POLICYKIT_ERROR_TITLES[name]);
    }
  });

  it("returns Unknown for unrelated errors", () => {
    const info = mapPolicyKitError(new Error("blockhash not found"));
    expect(info.name).to.equal("Unknown");
    expect(info.isPolicyRejection).to.equal(false);
    expect(info.title).to.equal("Transaction failed");
  });
});
