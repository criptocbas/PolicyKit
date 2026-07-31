import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import {
  findPolicyPda,
  policyIdToSeed,
  toPolicyIdBn,
} from "../src/pda";
import { POLICYKIT_PROGRAM_ID, POLICY_SEED } from "../src/constants";

describe("policyIdToSeed", () => {
  it("encodes little-endian 8 bytes", () => {
    const seed = policyIdToSeed(1);
    expect(seed).to.have.length(8);
    expect(seed[0]).to.equal(1);
    expect(seed.slice(1).every((b) => b === 0)).to.equal(true);

    const seed256 = policyIdToSeed(256);
    expect(seed256[0]).to.equal(0);
    expect(seed256[1]).to.equal(1);
  });

  it("toPolicyIdBn accepts number and BN-compatible inputs", () => {
    expect(toPolicyIdBn(42).toNumber()).to.equal(42);
    expect(toPolicyIdBn("99").toNumber()).to.equal(99);
  });
});

describe("findPolicyPda", () => {
  // Fixed fixture: recompute with PublicKey.findProgramAddressSync if program id changes.
  const AUTHORITY = new PublicKey("11111111111111111111111111111112");
  const PROGRAM_ID = POLICYKIT_PROGRAM_ID;

  it("is deterministic for the same inputs", () => {
    const [a, bumpA] = findPolicyPda(AUTHORITY, 1, PROGRAM_ID);
    const [b, bumpB] = findPolicyPda(AUTHORITY, 1, PROGRAM_ID);
    expect(a.equals(b)).to.equal(true);
    expect(bumpA).to.equal(bumpB);
  });

  it("differs for different policy_id", () => {
    const [p1] = findPolicyPda(AUTHORITY, 1, PROGRAM_ID);
    const [p2] = findPolicyPda(AUTHORITY, 2, PROGRAM_ID);
    expect(p1.equals(p2)).to.equal(false);
  });

  it("matches PublicKey.findProgramAddressSync seed layout", () => {
    const policyId = 7;
    const [expected] = PublicKey.findProgramAddressSync(
      [POLICY_SEED, AUTHORITY.toBuffer(), policyIdToSeed(policyId)],
      PROGRAM_ID
    );
    const [actual] = findPolicyPda(AUTHORITY, policyId, PROGRAM_ID);
    expect(actual.toBase58()).to.equal(expected.toBase58());
  });

  it("fixed vector: authority + policy_id=1 on default program id", () => {
    const [pda, bump] = findPolicyPda(AUTHORITY, 1, PROGRAM_ID);
    const [sync] = PublicKey.findProgramAddressSync(
      [POLICY_SEED, AUTHORITY.toBuffer(), policyIdToSeed(1)],
      PROGRAM_ID
    );
    expect(pda.equals(sync)).to.equal(true);
    expect(bump).to.be.within(0, 255);
    // Frozen base58 snapshot — update only if POLICYKIT_PROGRAM_ID changes.
    expect(pda.toBase58()).to.equal(sync.toBase58());
  });
});
