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
    excluded_grant_ids: [],
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

test("passes conversation_id and fetches search batches via ApiGrantService", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    if (requestedUrl.includes("/batches")) {
      return new Response(
        JSON.stringify({
          batches: [
            {
              id: "batch-1",
              conversationId: "conv-1",
              userId: null,
              batchIndex: 1,
              query: "AI robotics",
              profile: { organisationName: "RoboCorp" },
              grants: [
                {
                  id: "GRANT-1",
                  title: "Robotics EU",
                  description: "Robotics call",
                },
              ],
              sourceSummary: "EU Horizon",
              createdAt: "2026-08-28T12:00:00Z",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const sseBody = `data: ${JSON.stringify({
      event: "result",
      stage: "select",
      data: {
        grants: [],
        source_summary: "Empty",
        batch_id: "batch-new",
        batch_index: 2,
      },
    })}\n\n`;
    return new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };

  const service = new ApiGrantService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const profile: OrganisationProfile = {
    organisationName: "RoboCorp",
    organisationType: "SME",
    organisationDescription: "",
    country: "France",
    region: "",
    projectTitle: "AI robotics",
    projectDescription: "",
    sector: "Robotics",
    fundingAmount: "1M EUR",
    projectStartDate: "",
    projectDuration: "",
    eligibilityConstraints: "",
  };

  const searchRes = await service.searchGrants(profile, undefined, ["EX-1"], "conv-1");
  expect(JSON.parse(String(requestedInit?.body))).toMatchObject({
    conversation_id: "conv-1",
    excluded_grant_ids: ["EX-1"],
  });
  expect(searchRes.batchId).toBe("batch-new");
  expect(searchRes.batchIndex).toBe(2);

  const batches = await service.listSearchBatches("conv-1");
  expect(requestedUrl).toBe("http://localhost:8000/api/v1/grants/batches?conversation_id=conv-1");
  expect(batches).toHaveLength(1);
  expect(batches[0].id).toBe("batch-1");
  expect(batches[0].batchIndex).toBe(1);
  expect(batches[0].grants[0].title).toBe("Robotics EU");
});
