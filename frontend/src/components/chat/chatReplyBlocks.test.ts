import { describe, expect, it } from "vitest";
import type { ChatReply } from "@/services/ChatService";
import { chatReplyBlocks } from "./chatReplyBlocks";

const reply: ChatReply = {
  conversationId: "conversation-1",
  assistantMessage: "Complete the profile below.",
  nextStep: "collect_information",
  followUpQuestions: ["What type of organisation are you?", "Which country are you based in?"],
  toolResults: [],
};

describe("chatReplyBlocks", () => {
  it("keeps the persisted backend reply but suppresses questions beside the profile form", () => {
    expect(chatReplyBlocks(reply, true)).toEqual([
      { type: "text", text: "Complete the profile below." },
    ]);
  });

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
});
