import { describe, expect, test } from "bun:test";
import type { Grant } from "../../types";
import { grantResultProvenance } from "./grantPresentation";

const baseGrant: Grant = {
  id: "grant-1",
  title: "Example",
  description: "Example grant",
};

describe("grant result provenance", () => {
  test("treats legacy stored grants without provenance as saved results", () => {
    expect(grantResultProvenance([baseGrant])).toBe("saved");
  });

  test("recognizes live and mock result sets", () => {
    expect(grantResultProvenance([{ ...baseGrant, provenance: "live" }])).toBe("live");
    expect(grantResultProvenance([{ ...baseGrant, provenance: "mock" }])).toBe("mock");
  });
});
