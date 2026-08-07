import { expect, test } from "bun:test";
import type { Grant, OrganisationProfile } from "@/types";
import { ApiApplicationService } from "./ApiApplicationService";
import { ApiClient } from "./apiClient";

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
  projectDuration: "24 months",
  eligibilityConstraints: "",
};

const grant: Grant = {
  id: "MOCK-1",
  title: "Manufacturing Research and Innovation Action",
  description: "Mock backend grant",
  provenance: "live",
};

test("finds the latest saved application for a grant", async () => {
  let requestedUrl = "";
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        id: "doc-saved",
        grantId: "MOCK-1",
        grantTitle: "Manufacturing Research and Innovation Action",
        sections: [{ id: "executive-summary", title: "Executive Summary", content: "Saved" }],
        updatedAt: "2026-08-06T00:00:00Z",
        status: "draft",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const document = await service.findSavedApplication("MOCK-1");

  expect(requestedUrl).toBe("http://localhost:8000/api/v1/grants/MOCK-1/applications/latest");
  expect(document?.id).toBe("doc-saved");
});

test("returns no saved application when the grant lookup is not found", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ detail: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  expect(await service.findSavedApplication("MOCK-1")).toBeUndefined();
});

test("starts an application through the backend document endpoint", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(
      JSON.stringify({
        id: "doc-1",
        grantId: "MOCK-1",
        grantTitle: "Manufacturing Research and Innovation Action",
        sections: [{ id: "executive-summary", title: "Executive Summary", content: "Draft" }],
        updatedAt: "2026-07-30T00:00:00Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const document = await service.startApplication(grant, profile);

  expect(requestedUrl).toBe("http://localhost:8000/api/v1/grants/MOCK-1/start-application");
  expect(requestedInit?.method).toBe("POST");
  expect(JSON.parse(String(requestedInit?.body))).toEqual({ grant, profile });
  expect(document.sections[0]?.title).toBe("Executive Summary");
});

test("rewrites a section through the backend document endpoint", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(
      JSON.stringify({
        sectionId: "executive-summary",
        title: "Executive Summary",
        content: "Rewritten by backend mock",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const content = await service.rewriteSection(
    "Executive Summary",
    "Draft",
    profile,
    grant,
    "doc-1",
  );

  expect(requestedUrl).toBe(
    "http://localhost:8000/api/v1/documents/doc-1/sections/executive-summary",
  );
  expect(requestedInit?.method).toBe("PATCH");
  expect(JSON.parse(String(requestedInit?.body))).toEqual({
    sectionTitle: "Executive Summary",
    currentContent: "Draft",
    profile,
    grant,
  });
  expect(content).toBe("Rewritten by backend mock");
});
