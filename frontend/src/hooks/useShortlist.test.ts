import { describe, expect, it } from "vitest";
import { MOCK_GRANTS } from "@/data/mockGrants";
import { parseShortlist, toSavedGrant, type SavedGrant } from "./useShortlist";

const saved: SavedGrant = {
  id: "digital-europe",
  title: "Digital Transformation Accelerator for SMEs",
  programme: "Digital Europe Programme",
  fundingAmount: "€500,000 – €2,000,000",
  deadline: "2026-09-20",
  sourceUrl: "https://example.org/call",
  savedAt: "2026-08-07T10:00:00.000Z",
};

describe("toSavedGrant", () => {
  it("snapshots fields including match telemetry a standalone shortlist needs", () => {
    const entry = toSavedGrant(MOCK_GRANTS[0], "2026-08-07T10:00:00.000Z");
    expect(entry).toEqual({
      id: MOCK_GRANTS[0].id,
      title: MOCK_GRANTS[0].title,
      programme: MOCK_GRANTS[0].programme,
      fundingAmount: MOCK_GRANTS[0].fundingAmount,
      deadline: MOCK_GRANTS[0].deadline,
      sourceUrl: MOCK_GRANTS[0].sourceUrl,
      savedAt: "2026-08-07T10:00:00.000Z",
      matchPercentage: MOCK_GRANTS[0].matchPercentage,
      whyItMatches: MOCK_GRANTS[0].whyItMatches,
      matchReasons: MOCK_GRANTS[0].matchReasons,
      grant: MOCK_GRANTS[0],
    });
  });

  it("produces entries its own parser accepts, so a save round-trips", () => {
    const store = Object.fromEntries(
      MOCK_GRANTS.map((g) => [g.id, toSavedGrant(g, "2026-08-07T10:00:00.000Z")]),
    );
    expect(Object.keys(parseShortlist(JSON.stringify(store)))).toHaveLength(MOCK_GRANTS.length);
  });
});

describe("parseShortlist", () => {
  it("reads back a well-formed shortlist", () => {
    expect(parseShortlist(JSON.stringify({ [saved.id]: saved }))).toEqual({ [saved.id]: saved });
  });

  // Every branch below must yield an empty shortlist rather than throw: a
  // corrupt key can't be allowed to take down the grant results with it.
  it("returns empty for nothing stored", () => {
    expect(parseShortlist(null)).toEqual({});
    expect(parseShortlist("")).toEqual({});
  });

  it("returns empty for invalid JSON instead of throwing", () => {
    expect(parseShortlist("{not json")).toEqual({});
    expect(parseShortlist("[[")).toEqual({});
  });

  it("returns empty for JSON that isn't an object map", () => {
    expect(parseShortlist("null")).toEqual({});
    expect(parseShortlist('"a string"')).toEqual({});
    expect(parseShortlist("42")).toEqual({});
    expect(parseShortlist(JSON.stringify([saved]))).toEqual({});
  });

  it("drops only the malformed entries, keeping the good ones", () => {
    const mixed = JSON.stringify({
      [saved.id]: saved,
      broken: { id: "broken" },
      alsoBroken: null,
      wrongType: { ...saved, deadline: 20260920 },
    });
    expect(Object.keys(parseShortlist(mixed))).toEqual([saved.id]);
  });
});
