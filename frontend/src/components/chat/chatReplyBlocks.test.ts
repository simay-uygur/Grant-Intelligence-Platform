import { describe, expect, it } from "vitest";
import type { ChatReply } from "@/services/ChatService";
import { chatReplyBlocks, visibleChatBlocks } from "./chatReplyBlocks";

const reply: ChatReply = {
  conversationId: "conversation-1",
  assistantMessage: "Complete the profile below.",
  nextStep: "collect_information",
  followUpQuestions: ["What type of organisation are you?", "Which country are you based in?"],
  toolResults: [],
};

describe("chatReplyBlocks", () => {
  it("does not repeat collection questions when the backend marks the next step as collection", () => {
    expect(chatReplyBlocks(reply)).toEqual([{ type: "text", text: "Complete the profile below." }]);
  });

  it("renders follow-up questions for non-collection replies", () => {
    expect(chatReplyBlocks({ ...reply, nextStep: "refine_query" })).toEqual([
      { type: "text", text: "Complete the profile below." },
      { type: "question", text: "What type of organisation are you?" },
      { type: "question", text: "Which country are you based in?" },
    ]);
  });

  it("retains all message text and questions alongside forms", () => {
    const blocks: Parameters<typeof visibleChatBlocks>[0] = [
      { type: "text", text: "Complete the profile below." },
      { type: "question", text: "Which country?" },
      { type: "structured_form" },
    ];
    expect(visibleChatBlocks(blocks)).toEqual(blocks);
  });

  it("keeps an explanation beside a deliberately pre-filled form", () => {
    const profile = {
      organisationName: "Example Labs",
      organisationType: "SME",
      organisationDescription: "",
      country: "Germany",
      region: "",
      projectTitle: "Example project",
      projectDescription: "Example project description",
      fundingAmount: "€100,000 – €500,000",
      projectStartDate: "",
      projectDuration: "12 months",
      sector: "Digital & AI",
      eligibilityConstraints: "",
    };
    const blocks = [
      { type: "text" as const, text: "I pre-filled this from your message." },
      { type: "structured_form" as const, profile },
    ];

    expect(visibleChatBlocks(blocks)).toEqual(blocks);
  });
});
