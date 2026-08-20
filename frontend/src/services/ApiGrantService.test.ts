import { expect, test } from "vitest";
import type { OrganisationProfile } from "../types";
import { ApiGrantService } from "./ApiGrantService";
import { ApiClient } from "./apiClient";

test("calls the versioned grant stream endpoint and returns mapped live results", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    const sseBody = `data: ${JSON.stringify({
      event: "result",
      stage: "select",
      data: {
        grants: [
          {
            id: "HORIZON-1",
            title: "AI opportunity",
            source: "eu_horizon",
            summary: "Live result",
            amount: null,
            deadline: null,
            match_explanation: null,
            url: null,
          },
        ],
        source_summary: "Live Horizon search.",
        normalized_filters_applied: {},
      },
    })}\n\n`;
    return new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  const profile: OrganisationProfile = {
    organisationName: "Northlight",
    organisationType: "SME",
    organisationDescription: "",
    country: "Germany",
    region: "",
    projectTitle: "AI inspection",
    projectDescription: "",
    sector: "Manufacturing",
    fundingAmount: "EUR 500 000",
    projectStartDate: "",
    projectDuration: "",
    eligibilityConstraints: "",
  };
  const service = new ApiGrantService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const result = await service.searchGrants(profile);

  expect(requestedUrl).toBe("http://localhost:8000/api/v1/grants/search/stream");
  expect(requestedInit?.method).toBe("POST");
  expect(JSON.parse(String(requestedInit?.body))).toEqual({
    query: "AI inspection Manufacturing",
    organisationName: "Northlight",
    organisationType: "SME",
    country: "Germany",
    projectTitle: "AI inspection",
    sector: "Manufacturing",
    fundingAmount: "EUR 500 000",
    organization_type: "SME",
    only_open: true,
    limit: 3,
  });
  expect(result).toEqual({
    grants: [
      {
        id: "HORIZON-1",
        source: "eu_horizon",
        title: "AI opportunity",
        description: "Live result",
        provenance: "live",
      },
    ],
    sourceSummary: "Live Horizon search.",
  });
});

