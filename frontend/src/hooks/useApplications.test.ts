import { describe, expect, it } from "vitest";
import { MOCK_APPLICATIONS, type DemoApplication } from "@/data/mockApplications";
import { isApplication, parseStoredApplications } from "./useApplications";

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

  it("returns null for an empty array", () => {
    expect(parseStoredApplications("[]")).toBeNull();
  });

  it("rejects the whole array if any entry is malformed", () => {
    expect(parseStoredApplications(JSON.stringify([valid, { id: "broken" }]))).toBeNull();
  });
});
