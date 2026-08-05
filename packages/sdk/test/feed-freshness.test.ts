import { expect } from "chai";
import {
  assessFreshness,
  formatRelativeAge,
  parseLiveFeed,
  FRESHNESS_MS,
} from "../src/feed-freshness";

describe("formatRelativeAge", () => {
  const now = Date.parse("2026-08-04T12:00:00.000Z");

  it("formats minutes and hours", () => {
    expect(formatRelativeAge(now - 30_000, now)).to.equal("just now");
    expect(formatRelativeAge(now - 5 * 60_000, now)).to.equal("5m ago");
    expect(formatRelativeAge(now - 3 * 3600_000, now)).to.equal("3h ago");
    expect(formatRelativeAge(now - 3 * 86400_000, now)).to.equal("3d ago");
  });
});

describe("assessFreshness", () => {
  const now = Date.parse("2026-08-04T12:00:00.000Z");

  it("classifies live / recent / stale", () => {
    expect(
      assessFreshness(new Date(now - 60_000).toISOString(), now).level
    ).to.equal("live");
    expect(
      assessFreshness(
        new Date(now - FRESHNESS_MS.live - 1).toISOString(),
        now
      ).level
    ).to.equal("recent");
    expect(
      assessFreshness(
        new Date(now - FRESHNESS_MS.recent - 1).toISOString(),
        now
      ).level
    ).to.equal("stale");
  });

  it("handles missing", () => {
    expect(assessFreshness(null, now).level).to.equal("unknown");
  });
});

describe("parseLiveFeed", () => {
  it("parses legacy array", () => {
    const p = parseLiveFeed([
      {
        ts: "2026-08-01T00:00:00.000Z",
        kind: "allowed",
        ok: true,
        explorer: {
          policy:
            "https://solscan.io/account/GG9quehB9FZEexttoxanCxapSFMHxDhZ5gGV6wsHe66n?cluster=devnet",
        },
      },
    ]);
    expect(p.events).to.have.length(1);
    expect(p.updatedAt).to.equal("2026-08-01T00:00:00.000Z");
    expect(p.policy).to.equal("GG9quehB9FZEexttoxanCxapSFMHxDhZ5gGV6wsHe66n");
  });

  it("parses versioned document", () => {
    const p = parseLiveFeed({
      version: 1,
      updatedAt: "2026-08-04T10:00:00.000Z",
      cluster: "devnet",
      policy: "GG9quehB9FZEexttoxanCxapSFMHxDhZ5gGV6wsHe66n",
      programId: "AoTJDX2z2ej5r4UUKCofEbgDUXApWpGhQnvfk8seZf27",
      tickCount: 2,
      events: [
        { ts: "2026-08-04T10:00:00.000Z", kind: "allowed", ok: true },
        { ts: "2026-08-04T10:00:01.000Z", kind: "reject_program", ok: true },
      ],
    });
    expect(p.events).to.have.length(2);
    expect(p.updatedAt).to.equal("2026-08-04T10:00:00.000Z");
    expect(p.policy).to.equal("GG9quehB9FZEexttoxanCxapSFMHxDhZ5gGV6wsHe66n");
  });
});
