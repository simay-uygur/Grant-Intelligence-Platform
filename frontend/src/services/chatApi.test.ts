import { describe, expect, test } from "bun:test";
import type { OrganisationProfile } from "@/types";
import {
  buildChatMessageRequest,
  ChatApiContractError,
  parseChatHistory,
  parseChatReply,
  parseConversation,
} from "./chatApi";

const profile: OrganisationProfile = {
  organisationName: "E2E Labs",
  organisationType: "SME",
  organisationDescription: "An applied research company.",
  country: "Germany",
  region: "Berlin",
  projectTitle: "Sustainable AI",
  projectDescription: "Reduce industrial energy use with AI.",
  sector: "Digital & AI",
  fundingAmount: "€100,000 – €500,000",
  projectStartDate: "",
  projectDuration: "12 months",
  eligibilityConstraints: "",
};

describe("chat API mapping", () => {
  test("maps the frontend profile into backend chat context", () => {
    expect(
      buildChatMessageRequest({
        conversationId: "backend-conversation",
        sessionId: "local-conversation",
        userMessage: "What should I do next?",
        profile,
      }),
    ).toEqual({
      conversation_id: "backend-conversation",
      session_id: "local-conversation",
      user_message: "What should I do next?",
      context: {
        organization_type: "SME",
        country: "Germany",
        budget_range: "€100,000 – €500,000",
        project_goal: "Reduce industrial energy use with AI.",
      },
    });
  });

  test("maps a valid backend chat reply", () => {
    expect(
      parseChatReply({
        conversation_id: "backend-conversation",
        assistant_message: "Backend response",
        next_step: "collect_information",
        follow_up_questions: ["Which country?"],
        tool_results: [],
      }),
    ).toEqual({
      conversationId: "backend-conversation",
      assistantMessage: "Backend response",
      nextStep: "collect_information",
      followUpQuestions: ["Which country?"],
      toolResults: [],
    });
  });

  test("uses profile fallbacks and omits empty context values", () => {
    expect(
      buildChatMessageRequest({
        conversationId: "backend-conversation",
        sessionId: "local-conversation",
        userMessage: "Help me find funding",
        profile: {
          ...profile,
          organisationType: "",
          country: "",
          fundingAmount: "",
          projectDescription: "",
        },
      }),
    ).toEqual({
      conversation_id: "backend-conversation",
      session_id: "local-conversation",
      user_message: "Help me find funding",
      context: {
        organization_type: undefined,
        country: undefined,
        budget_range: undefined,
        project_goal: "Sustainable AI",
      },
    });
  });

  test("maps conversation creation and persisted history", () => {
    expect(
      parseConversation({
        conversation_id: "backend-conversation",
        created_at: "2026-07-28T20:00:00Z",
        updated_at: "2026-07-28T20:01:00Z",
      }),
    ).toEqual({
      conversationId: "backend-conversation",
      createdAt: "2026-07-28T20:00:00Z",
      updatedAt: "2026-07-28T20:01:00Z",
    });

    expect(
      parseChatHistory({
        conversation_id: "backend-conversation",
        messages: [
          {
            message_id: 7,
            conversation_id: "backend-conversation",
            role: "assistant",
            content: "Persisted reply",
            created_at: "2026-07-28T20:02:00Z",
          },
        ],
      }),
    ).toEqual([
      {
        messageId: 7,
        conversationId: "backend-conversation",
        role: "assistant",
        content: "Persisted reply",
        createdAt: "2026-07-28T20:02:00Z",
      },
    ]);
  });

  test("rejects malformed chat replies", () => {
    expect(() => parseChatReply({ assistant_message: "Missing fields" })).toThrow(
      ChatApiContractError,
    );
  });

  test("rejects malformed conversation and history responses", () => {
    expect(() => parseConversation({ conversation_id: "" })).toThrow(
      ChatApiContractError,
    );
    expect(() =>
      parseChatHistory({
        conversation_id: "backend-conversation",
        messages: [{ role: "user", content: "Missing persisted fields" }],
      }),
    ).toThrow(ChatApiContractError);
  });
});
