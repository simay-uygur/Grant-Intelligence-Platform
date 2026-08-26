import { describe, expect, test } from "vitest";
import type { OrganisationProfile } from "../types";
import {
  buildGrantSearchRequest,
  GrantApiContractError,
  mapGrantResult,
  parseGrantSearchResponse,
} from "./grantApi";

const profile: OrganisationProfile = {
  organisationName: "Northlight Robotics",
  organisationType: "SME",
  organisationDescription: "Robotics company",
  country: "Germany",
  region: "Bavaria",
  projectTitle: "Explainable AI inspection",
  projectDescription: "Computer vision for factories",
  sector: "Digital & AI",
  fundingAmount: "€500,000 – €1,000,000",
  projectStartDate: "2027-06-01",
  projectDuration: "24 months",
  eligibilityConstraints: "",
};

describe("grant API mapping", () => {
  test("builds the backend request without deriving budget filters", () => {
    expect(buildGrantSearchRequest(profile, ["HORIZON-OLD-01"])).toEqual({
      query: "Explainable AI inspection Digital & AI",
      organisationName: "Northlight Robotics",
      organisationType: "SME",
      organisationDescription: "Robotics company",
      sector: "Digital & AI",
      country: "Germany",
      region: "Bavaria",
      projectTitle: "Explainable AI inspection",
      projectDescription: "Computer vision for factories",
      fundingAmount: "€500,000 – €1,000,000",
      projectStartDate: "2027-06-01",
      projectDuration: "24 months",
      organization_type: "SME",
      eligibilityConstraints: undefined,
      only_open: true,
      limit: 3,
      excluded_grant_ids: ["HORIZON-OLD-01"],
    });
  });

  test("uses a stable fallback query for an empty profile", () => {
    const empty = Object.fromEntries(
      Object.keys(profile).map((key) => [key, ""]),
    ) as unknown as OrganisationProfile;
    expect(buildGrantSearchRequest(empty)).toEqual({
      query: "Horizon Europe",
      organisationName: undefined,
      organisationType: undefined,
      organisationDescription: undefined,
      sector: undefined,
      country: undefined,
      region: undefined,
      projectTitle: undefined,
      projectDescription: undefined,
      fundingAmount: undefined,
      projectStartDate: undefined,
      projectDuration: undefined,
      organization_type: undefined,
      eligibilityConstraints: undefined,
      only_open: true,
      limit: 3,
      excluded_grant_ids: [],
    });
  });

  test("maps a full backend grant without inventing frontend-only fields", () => {
    const response = parseGrantSearchResponse({
      grants: [
        {
          id: "HORIZON-1",
          title: "AI call",
          source: "eu_horizon",
          summary: "A live opportunity",
          amount: "EUR 500 000",
          deadline: "2026-12-01",
          match_explanation: "Matched AI",
          url: "https://example.test/HORIZON-1",
        },
      ],
      source_summary: "One live result.",
      normalized_filters_applied: { query: "AI", limit: 3, only_open: true },
    });

    expect(mapGrantResult(response.grants[0])).toEqual({
      id: "HORIZON-1",
      source: "eu_horizon",
      title: "AI call",
      description: "A live opportunity",
      provenance: "live",
      fundingAmount: "EUR 500 000",
      deadline: "2026-12-01",
      whyItMatches: "Matched AI",
      sourceUrl: "https://example.test/HORIZON-1",
    });
  });

  test("keeps nullable backend fields unavailable", () => {
    const response = parseGrantSearchResponse({
      grants: [
        {
          id: "HORIZON-2",
          title: "Minimal call",
          source: "eu_horizon",
          summary: "Only guaranteed fields",
          amount: null,
          deadline: null,
          match_explanation: null,
          url: null,
        },
      ],
      source_summary: "One minimal result.",
      normalized_filters_applied: {},
    });

    const grant = mapGrantResult(response.grants[0]);
    expect(grant.fundingAmount).toBeUndefined();
    expect(grant.deadline).toBeUndefined();
    expect(grant.whyItMatches).toBeUndefined();
    expect(grant.sourceUrl).toBeUndefined();
    expect(grant.matchPercentage).toBeUndefined();
  });

  test("rejects malformed backend responses with a stable error", () => {
    expect(() => parseGrantSearchResponse({ grants: "not-an-array" })).toThrow(
      GrantApiContractError,
    );
    expect(() => parseGrantSearchResponse({ grants: "not-an-array" })).toThrow(
      "The grant backend returned data in an unexpected format.",
    );
  });
});
