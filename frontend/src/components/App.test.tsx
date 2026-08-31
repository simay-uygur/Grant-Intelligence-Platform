// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationDocument, Grant, OrganisationProfile } from "@/types";
import type { DemoApplication } from "@/data/mockApplications";

const pipelineApplication: DemoApplication = {
  id: "pipeline-1",
  grantId: "grant-1",
  grantTitle: "Pipeline Grant",
  grantOrganisation: "Horizon Europe",
  applicantOrganisation: "Acme Labs",
  status: "drafting",
  fundingAmount: "EUR 500 000",
  deadline: "2027-01-31",
  updatedAt: "2026-08-31T19:00:00Z",
};

const draftedDocument: ApplicationDocument = {
  id: "doc-pipeline-1",
  grantId: "grant-1",
  grantTitle: "Pipeline Grant",
  sections: [{ id: "summary", title: "Executive Summary", content: "Draft text.", revision: 1 }],
  updatedAt: "2026-08-31T19:01:00Z",
};

let resolveStartApplication: ((document: ApplicationDocument) => void) | undefined;
const createBackendConversation = vi.fn().mockResolvedValue({
  conversationId: "backend-conversation-1",
  createdAt: "2026-08-31T19:02:00Z",
  updatedAt: "2026-08-31T19:02:00Z",
});
const sendChatMessage = vi.fn().mockResolvedValue({
  conversationId: "backend-conversation-1",
  assistantMessage: "Great — please complete the profile.",
  nextStep: "collect_information",
  followUpQuestions: [],
  toolResults: [],
});
const startApplication = vi.fn(
  (
    _grant: Grant,
    _profile: OrganisationProfile,
    onProgress?: (event: {
      event: string;
      stage?: string;
      message?: string;
      data?: Record<string, unknown>;
    }) => void,
  ) => {
    onProgress?.({
      event: "section_chunk",
      stage: "draft",
      message: "Drafting Section 1/1: Executive Summary...",
      data: {
        section_index: 1,
        total_sections: 1,
        progress_percent: 25,
        section_title: "Executive Summary",
        accumulated_content: "Drafting text",
        word_count: 2,
      },
    });
    return new Promise<ApplicationDocument>((resolve) => {
      resolveStartApplication = resolve;
    });
  },
);

vi.mock("@/services", () => ({
  isMockMode: false,
  chatService: {
    createConversation: createBackendConversation,
    sendMessage: sendChatMessage,
    getMessages: vi.fn(),
  },
  backendService: undefined,
  grantService: {
    searchGrants: vi.fn(),
  },
  applicationService: {
    listApplications: vi.fn().mockResolvedValue([pipelineApplication]),
    startApplication,
    saveSection: vi.fn(),
    findSavedApplication: vi.fn(),
    updateApplicationStatus: vi.fn(),
    upsertApplicationSummary: vi.fn(),
    deleteApplication: vi.fn(),
  },
}));

describe("App pipeline drafting", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("gi.auth.v1", "1");
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    resolveStartApplication = undefined;
    createBackendConversation.mockClear();
    sendChatMessage.mockClear();
    startApplication.mockClear();
  });

  it("opens a new chat with visible draft progress when starting from Pipeline", async () => {
    const { App } = await import("./App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Pipeline/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /View Pipeline Grant application details/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /Open application draft/i }));

    expect(await screen.findByText("Drafting Grant Application")).toBeDefined();
    expect(screen.getAllByText("Pipeline Grant").length).toBeGreaterThan(0);
    expect(screen.getByText("Executive Summary")).toBeDefined();
    expect(startApplication).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveStartApplication?.(draftedDocument);
    });

    await waitFor(() => {
      expect(screen.getByText("Application draft created for Pipeline Grant.")).toBeDefined();
    });
  });

  it("links a fresh local chat to the backend before sending the first message", async () => {
    const { App } = await import("./App");
    render(<App />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "I'd like to find grants for my organisation." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(createBackendConversation).toHaveBeenCalledTimes(1);
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "backend-conversation-1",
          sessionId: "backend-conversation-1",
          userMessage: "I'd like to find grants for my organisation.",
        }),
      );
    });
    expect(screen.queryByText(/could not find this conversation/i)).toBeNull();
  });
});
