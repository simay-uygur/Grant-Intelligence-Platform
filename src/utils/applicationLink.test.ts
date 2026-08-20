import { describe, expect, it } from "vitest";
import type { ApplicationDocument, Conversation } from "@/types";
import type { DemoApplication } from "@/data/mockApplications";
import { resolveApplicationLink } from "./applicationLink";

const doc = (id: string): ApplicationDocument => ({
  id,
  grantId: "digital-europe",
  grantTitle: "Digital Transformation Accelerator for SMEs",
  sections: [],
  updatedAt: "2026-08-10T09:00:00.000Z",
});

function conversation(
  id: string,
  options: { document?: ApplicationDocument; documentBlockIds?: string[] } = {},
): Conversation {
  return {
    id,
    title: `Conversation ${id}`,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
    stage: "application",
    document: options.document,
    messages: (options.documentBlockIds ?? []).map((documentId, i) => ({
      id: `${id}-m${i}`,
      role: "assistant" as const,
      createdAt: "2026-08-01T09:00:00.000Z",
      blocks: [{ type: "document" as const, documentId }],
    })),
  };
}

const application = (id: string): DemoApplication => ({
  id,
  grantId: "digital-europe",
  grantTitle: "Digital Transformation Accelerator for SMEs",
  grantOrganisation: "Digital Europe Programme",
  applicantOrganisation: "Northlight Robotics",
  status: "drafting",
  fundingAmount: "€500,000 – €2,000,000",
  deadline: "2026-09-20",
  updatedAt: "2026-08-10T09:00:00.000Z",
});

describe("resolveApplicationLink", () => {
  it("offers both actions when the draft is the conversation's current document", () => {
    const conversations = [
      conversation("c1", { document: doc("doc-x-1"), documentBlockIds: ["doc-x-1"] }),
    ];
    expect(resolveApplicationLink(application("app-doc-x-1"), conversations)).toEqual({
      conversationId: "c1",
      hasLiveDraft: true,
      reason: null,
    });
  });

  // Conversation.document is singular, so a later start replaces it — but the
  // transcript still holds the block, which is what keeps the conversation
  // reachable after the draft itself is gone.
  it("keeps the conversation reachable when a newer draft replaced this one", () => {
    const conversations = [
      conversation("c1", {
        document: doc("doc-y-2"),
        documentBlockIds: ["doc-x-1", "doc-y-2"],
      }),
    ];
    const link = resolveApplicationLink(application("app-doc-x-1"), conversations);
    expect(link.conversationId).toBe("c1");
    expect(link.hasLiveDraft).toBe(false);
    expect(link.reason).toMatch(/newer application/i);
    // Names the application that took the slot, and points at the way forward.
    expect(link.reason).toContain("Digital Transformation Accelerator for SMEs");
    expect(link.reason).toMatch(/open the conversation/i);
  });

  it("falls back to the unnamed wording when the newer document is missing", () => {
    const conversations = [conversation("c1", { documentBlockIds: ["doc-x-1"] })];
    const link = resolveApplicationLink(application("app-doc-x-1"), conversations);
    expect(link.conversationId).toBe("c1");
    expect(link.reason).toMatch(/^A newer application replaced this draft/);
  });

  it("finds the right conversation among several", () => {
    const conversations = [
      conversation("c1", { document: doc("doc-other-9"), documentBlockIds: ["doc-other-9"] }),
      conversation("c2", { document: doc("doc-x-1"), documentBlockIds: ["doc-x-1"] }),
    ];
    expect(resolveApplicationLink(application("app-doc-x-1"), conversations).conversationId).toBe(
      "c2",
    );
  });

  it("offers nothing for a demo application, and says why", () => {
    const conversations = [conversation("c1", { document: doc("doc-x-1") })];
    const link = resolveApplicationLink(application("app-demo-1"), conversations);
    expect(link).toEqual({
      conversationId: null,
      hasLiveDraft: false,
      reason: expect.stringMatching(/Demo application/i),
    });
  });

  it("reports an unknown source rather than guessing", () => {
    const link = resolveApplicationLink(application("app-doc-gone-3"), [conversation("c1")]);
    expect(link.conversationId).toBeNull();
    expect(link.hasLiveDraft).toBe(false);
    expect(link.reason).toMatch(/no longer available/i);
  });

  it("handles an id that isn't in the app- scheme at all", () => {
    const link = resolveApplicationLink(application("legacy-42"), [
      conversation("c1", { document: doc("doc-x-1") }),
    ]);
    expect(link.conversationId).toBeNull();
    expect(link.hasLiveDraft).toBe(false);
  });

  it("never claims a draft when there are no conversations", () => {
    expect(resolveApplicationLink(application("app-doc-x-1"), [])).toMatchObject({
      conversationId: null,
      hasLiveDraft: false,
    });
  });
});
