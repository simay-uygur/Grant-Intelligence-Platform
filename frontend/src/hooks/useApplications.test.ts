import { describe, expect, it } from "vitest";
import { MOCK_APPLICATIONS, type DemoApplication } from "@/data/mockApplications";
import { applyUpsert, isApplication, parseStoredApplications } from "./useApplications";

const valid: DemoApplication = {
  id: "app-1",
  grantId: "grant-1",
  grantTitle: "A grant",
  grantOrganisation: "A funder",
  applicantOrganisation: "An applicant",
  status: "drafting",
  fundingAmount: "€100,000",
  deadline: "2026-09-20",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("isApplication", () => {
  it("accepts a well-formed application", () => {
    expect(isApplication(valid)).toBe(true);
  });

  it("accepts every status in the union", () => {
    for (const status of [
      "drafting",
      "submitted",
      "under_review",
      "approved",
      "rejected",
    ] as const) {
      expect(isApplication({ ...valid, status })).toBe(true);
    }
  });

  // An unknown status is the dangerous case: it belongs to no column, so the
  // card would silently vanish from the board rather than look wrong.
  it("rejects a status outside the union", () => {
    expect(isApplication({ ...valid, status: "archived" })).toBe(false);
    expect(isApplication({ ...valid, status: "" })).toBe(false);
  });

  it("rejects a record with a missing or mistyped field", () => {
    const { deadline: _deadline, ...missingDeadline } = valid;
    expect(isApplication(missingDeadline)).toBe(false);
    expect(isApplication({ ...valid, fundingAmount: 100000 })).toBe(false);
    expect(isApplication({ ...valid, id: null })).toBe(false);
  });

  it("rejects non-objects without throwing", () => {
    for (const value of [null, undefined, "app", 42, [], true]) {
      expect(isApplication(value)).toBe(false);
    }
  });

  it("accepts the demo seed, so seeding can't loop", () => {
    // If the guard rejected the seed's own shape, every load would re-seed and
    // silently discard the user's status changes.
    expect(MOCK_APPLICATIONS.every(isApplication)).toBe(true);
    expect(parseStoredApplications(JSON.stringify(MOCK_APPLICATIONS))).toHaveLength(
      MOCK_APPLICATIONS.length,
    );
  });
});

describe("parseStoredApplications", () => {
  it("returns the applications when the stored value is usable", () => {
    expect(parseStoredApplications(JSON.stringify([valid]))).toEqual([valid]);
  });

  // Each of these means "fall back to the demo seed".
  it("returns null for nothing stored", () => {
    expect(parseStoredApplications(null)).toBeNull();
    expect(parseStoredApplications("")).toBeNull();
  });

  it("returns null for invalid JSON instead of throwing", () => {
    expect(parseStoredApplications("{not json")).toBeNull();
    expect(parseStoredApplications("undefined")).toBeNull();
  });

  it("returns null for JSON that isn't an array of applications", () => {
    expect(parseStoredApplications('{"a":1}')).toBeNull();
    expect(parseStoredApplications('"a string"')).toBeNull();
    expect(parseStoredApplications("null")).toBeNull();
  });

  it("respects an empty array rather than treating it as uninitialised", () => {
    expect(parseStoredApplications("[]")).toEqual([]);
  });

  it("rejects the whole array if any entry is malformed", () => {
    expect(parseStoredApplications(JSON.stringify([valid, { id: "broken" }]))).toBeNull();
  });

  it("separates missing/corrupt storage from an intentionally empty pipeline", () => {
    expect(parseStoredApplications(null)).toBeNull();
    expect(parseStoredApplications("{not json")).toBeNull();
    expect(parseStoredApplications("[]")).not.toBeNull();
  });
});

describe("applyUpsert", () => {
  const started = (grantId: string, overrides: Partial<DemoApplication> = {}): DemoApplication => ({
    ...valid,
    id: `doc-${grantId}-1`,
    grantId,
    grantTitle: `Grant ${grantId}`,
    ...overrides,
  });

  it("prepends a new application", () => {
    const existing = [started("a")];
    const after = applyUpsert(existing, started("b"));
    expect(after).toHaveLength(2);
    expect(after[0].grantId).toBe("b");
    expect(after[1]).toBe(existing[0]);
  });

  it("updates in place for a repeat start on the same grant", () => {
    const before = [started("a", { grantTitle: "Old title" }), started("b")];
    const after = applyUpsert(before, started("a", { grantTitle: "Refreshed title" }));
    expect(after).toHaveLength(2);
    expect(after.filter((a) => a.grantId === "a")).toHaveLength(1);
    expect(after.find((a) => a.grantId === "a")?.grantTitle).toBe("Refreshed title");
  });

  it("keeps the existing row's status and id on update", () => {
    const before = [started("a", { id: "doc-original", status: "submitted" })];
    const after = applyUpsert(before, started("a", { id: "doc-new", status: "drafting" }));
    expect(after[0].status).toBe("submitted");
    expect(after[0].id).toBe("doc-original");
  });

  it("keeps position and leaves other rows untouched by reference", () => {
    const other = started("b");
    const before = [other, started("a")];
    const after = applyUpsert(before, started("a", { grantTitle: "Refreshed" }));
    expect(after.map((a) => a.grantId)).toEqual(["b", "a"]);
    expect(after[0]).toBe(other);
  });

  it("does not mutate the input array", () => {
    const before = [started("a")];
    const snapshot = JSON.stringify(before);
    applyUpsert(before, started("b"));
    applyUpsert(before, started("a", { grantTitle: "Refreshed" }));
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
