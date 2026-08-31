import { expect, test } from "vitest";
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
        createdAt: "2026-08-05T12:30:00Z",
        updatedAt: "2026-08-06T00:00:00Z",
        status: "drafting",
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
  expect(document?.createdAt).toBe("2026-08-05T12:30:00Z");
});

test("lists stored applications for the pipeline dashboard", async () => {
  let requestedUrl = "";
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        applications: [
          {
            id: "doc-1",
            grantId: "MOCK-1",
            grantTitle: "Manufacturing Research and Innovation Action",
            grantOrganisation: "Horizon Europe",
            applicantOrganisation: "Northlight",
            status: "drafting",
            fundingAmount: "EUR 500 000",
            deadline: "2026-12-31",
            sectionCount: 12,
            createdAt: "2026-08-06T00:00:00Z",
            updatedAt: "2026-08-06T00:00:00Z",
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const applications = await service.listApplications();

  expect(requestedUrl).toBe("http://localhost:8000/api/v1/applications");
  expect(applications).toEqual([
    {
      id: "doc-1",
      grantId: "MOCK-1",
      grantTitle: "Manufacturing Research and Innovation Action",
      grantOrganisation: "Horizon Europe",
      applicantOrganisation: "Northlight",
      status: "drafting",
      fundingAmount: "EUR 500 000",
      deadline: "2026-12-31",
      updatedAt: "2026-08-06T00:00:00Z",
    },
  ]);
});

test("opens a stored application with grant and profile context", async () => {
  let requestedUrl = "";
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        id: "doc-1",
        grantId: "MOCK-1",
        grantTitle: "Manufacturing Research and Innovation Action",
        status: "drafting",
        sections: [{ id: "executive-summary", title: "Executive Summary", content: "Draft" }],
        grant,
        profile,
        createdAt: "2026-08-06T00:00:00Z",
        updatedAt: "2026-08-07T00:00:00Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const opened = await service.getApplication("doc-1");

  expect(requestedUrl).toBe("http://localhost:8000/api/v1/applications/doc-1");
  expect(opened.document.id).toBe("doc-1");
  expect(opened.document.createdAt).toBe("2026-08-06T00:00:00Z");
  expect(opened.grant?.id).toBe("MOCK-1");
  expect(opened.profile?.organisationName).toBe("Northlight");
});

test("updates application status through the backend pipeline endpoint", async () => {
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
        status: "submitted",
        sections: [{ id: "executive-summary", title: "Executive Summary", content: "Draft" }],
        grant: {
          programme: "Horizon Europe",
          fundingAmount: "EUR 500 000",
          deadline: "2026-12-31",
        },
        profile: { organisationName: "Northlight" },
        createdAt: "2026-08-06T00:00:00Z",
        updatedAt: "2026-08-07T00:00:00Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const application = await service.updateApplicationStatus("doc-1", "submitted");

  expect(requestedUrl).toBe("http://localhost:8000/api/v1/applications/doc-1");
  expect(requestedInit?.method).toBe("PATCH");
  expect(JSON.parse(String(requestedInit?.body))).toEqual({ status: "submitted" });
  expect(application.status).toBe("submitted");
  expect(application.grantOrganisation).toBe("Horizon Europe");
});

test("saves edited application sections through the backend endpoint", async () => {
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
        status: "drafting",
        sections: [{ id: "executive-summary", title: "Executive Summary", content: "Edited" }],
        updatedAt: "2026-08-07T00:00:00Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const document = await service.saveSection("doc-1", "executive-summary", "Edited", 1);

  expect(requestedUrl).toBe(
    "http://localhost:8000/api/v1/applications/doc-1/sections/executive-summary",
  );
  expect(requestedInit?.method).toBe("PUT");
  expect(JSON.parse(String(requestedInit?.body))).toEqual({ content: "Edited", baseRevision: 1 });
  expect(document.sections[0]?.revision).toBe(1);
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

test("starts an application through the backend document stream endpoint", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    const sseBody = `data: ${JSON.stringify({
      event: "result",
      stage: "draft",
      data: {
        document: {
          id: "doc-1",
          grantId: "MOCK-1",
          grantTitle: "Manufacturing Research and Innovation Action",
          sections: [{ id: "executive-summary", title: "Executive Summary", content: "Draft" }],
          updatedAt: "2026-07-30T00:00:00Z",
        },
      },
    })}\n\n`;
    return new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const document = await service.startApplication(grant, profile);

  expect(requestedUrl).toBe("http://localhost:8000/api/v1/grants/MOCK-1/start-application/stream");
  expect(requestedInit?.method).toBe("POST");
  expect(JSON.parse(String(requestedInit?.body))).toEqual({ grant, profile });
  expect(document.sections[0]?.title).toBe("Executive Summary");
});

test("rewrites a section through the backend document stream endpoint", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    const sseBody = `data: ${JSON.stringify({
      event: "result",
      stage: "rewrite",
      data: {
        sectionId: "executive-summary",
        title: "Executive Summary",
        content: "Rewritten by backend mock",
      },
    })}\n\n`;
    return new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const rewrite = await service.rewriteSection(
    "Executive Summary",
    "Draft",
    profile,
    grant,
    "doc-1",
    undefined,
    undefined,
    { baseRevision: 1, persist: false },
  );

  expect(requestedUrl).toBe(
    "http://localhost:8000/api/v1/documents/doc-1/sections/executive-summary/stream",
  );
  expect(requestedInit?.method).toBe("PATCH");
  expect(JSON.parse(String(requestedInit?.body))).toEqual({
    sectionTitle: "Executive Summary",
    currentContent: "Draft",
    profile,
    grant,
    baseRevision: 1,
    persist: false,
  });
  expect(rewrite.content).toBe("Rewritten by backend mock");
  expect(rewrite.baseRevision).toBeUndefined();
});

test("rewrites a section using the stored section id when provided", async () => {
  let requestedUrl = "";
  const fetchImpl: typeof fetch = async (input) => {
    requestedUrl = String(input);
    const sseBody = `data: ${JSON.stringify({
      event: "result",
      stage: "rewrite",
      data: {
        sectionId: "kpi-framework",
        title: "7. Evaluation Framework & Key Performance Indicators",
        content: "Rewritten by backend mock",
      },
    })}\n\n`;
    return new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  await service.rewriteSection(
    "7. Evaluation Framework & Key Performance Indicators",
    "Draft",
    profile,
    grant,
    "doc-1",
    undefined,
    "shorten the last section",
    { sectionId: "kpi-framework", baseRevision: 3, persist: true },
  );

  expect(requestedUrl).toBe(
    "http://localhost:8000/api/v1/documents/doc-1/sections/kpi-framework/stream",
  );
});

test("generates tailored outline through the backend outline endpoint", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(
      JSON.stringify({
        grantId: "MOCK-1",
        grantTitle: "Manufacturing Research and Innovation Action",
        sourceUrl:
          "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/horizon-cl4-2024-01",
        programme: "Horizon Europe",
        sections: [
          {
            id: "excellence",
            title: "1. Excellence",
            description: "Methodology and scientific novelty",
            targetWords: 200,
          },
          {
            id: "impact",
            title: "2. Impact",
            description: "Scale and dissemination pathways",
            targetWords: 180,
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const sections = await service.generateOutline(grant, profile);

  expect(requestedUrl).toBe("http://localhost:8000/api/v1/grants/MOCK-1/outline");
  expect(requestedInit?.method).toBe("POST");
  expect(sections).toHaveLength(2);
  expect(sections[0]?.id).toBe("excellence");
  expect(sections[0]?.title).toBe("1. Excellence");
  expect(sections[0]?.targetWords).toBe(200);
});

test("starts application with custom sections and sourceUrl", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const customSections = [
    { id: "excellence", title: "1. Excellence" },
    { id: "impact", title: "2. Impact" },
  ];
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    const sseBody = `data: ${JSON.stringify({
      event: "result",
      stage: "draft",
      data: {
        document: {
          id: "doc-custom-sections",
          grantId: "MOCK-1",
          grantTitle: "Manufacturing Research and Innovation Action",
          sourceUrl: "https://ec.europa.eu/call-1",
          programme: "Horizon Europe",
          sections: [
            { id: "excellence", title: "1. Excellence", content: "Excellence content" },
            { id: "impact", title: "2. Impact", content: "Impact content" },
          ],
          updatedAt: "2026-08-28T00:00:00Z",
        },
      },
    })}\n\n`;
    return new Response(sseBody, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };
  const service = new ApiApplicationService(
    undefined,
    new ApiClient("http://localhost:8000/", fetchImpl),
  );

  const document = await service.startApplication(grant, profile, undefined, {
    sections: customSections,
  });

  expect(requestedUrl).toBe("http://localhost:8000/api/v1/grants/MOCK-1/start-application/stream");
  expect(JSON.parse(String(requestedInit?.body))).toEqual({
    grant,
    profile,
    sections: customSections,
  });
  expect(document.sourceUrl).toBe("https://ec.europa.eu/call-1");
  expect(document.programme).toBe("Horizon Europe");
  expect(document.sections).toHaveLength(2);
});
