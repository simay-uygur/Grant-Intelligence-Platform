import { describe, expect, test } from "vitest";
import type { Grant } from "../../types";
import {
  getGrantSourceLabel,
  getGrantSourceType,
  grantResultProvenance,
} from "./grantPresentation";

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

describe("grant source classification", () => {
  test("categorizes web discovery grants", () => {
    const webGrant: Grant = {
      ...baseGrant,
      id: "web-123",
      source: "Web Search",
      programme: "Innovate UK Grant",
    };
    expect(getGrantSourceType(webGrant)).toBe("web_discovery");
    expect(getGrantSourceLabel(webGrant)).toBe("Web Discovery");
  });

  test("categorizes EU Horizon and Portal grants", () => {
    const euGrant: Grant = {
      ...baseGrant,
      id: "HORIZON-CL4-2025",
      source: "EU Horizon API",
      programme: "Horizon Europe",
    };
    expect(getGrantSourceType(euGrant)).toBe("eu_portal");
    expect(getGrantSourceLabel(euGrant)).toBe("EU Horizon API");
  });
});
