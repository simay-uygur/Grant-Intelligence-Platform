import { describe, expect, test } from "bun:test";
import type { ChatHistoryMessage } from "./ChatService";
import { mergeBackendHistory } from "./chatHistory";
import type { ChatMessage } from "@/types";

const history: ChatHistoryMessage[] = [
  {
    messageId: 1,
    conversationId: "backend-1",
    role: "user",
    content: "Earlier backend question",
    createdAt: "2026-07-28T20:01:00Z",
  },
  {
    messageId: 2,
    conversationId: "backend-1",
    role: "assistant",
    content: "Earlier backend answer",
    createdAt: "2026-07-28T20:02:00Z",
  },
];

describe("backend chat history merge", () => {
  test("restores backend messages missing from local storage", () => {
    const local: ChatMessage[] = [
      {
        id: "welcome",
        role: "assistant",
        createdAt: "2026-07-28T20:00:00Z",
        blocks: [{ type: "text", text: "Welcome" }],
      },
    ];

    expect(mergeBackendHistory(local, history)).toEqual([
      local[0],
      {
        id: "backend-backend-1-1",
        backendMessageId: 1,
        role: "user",
        createdAt: "2026-07-28T20:01:00Z",
        blocks: [{ type: "text", text: "Earlier backend question" }],
      },
      {
        id: "backend-backend-1-2",
        backendMessageId: 2,
        role: "assistant",
        createdAt: "2026-07-28T20:02:00Z",
        blocks: [{ type: "text", text: "Earlier backend answer" }],
      },
    ]);
  });

  test("matches existing text and preserves richer local blocks", () => {
    const local: ChatMessage[] = [
      {
        id: "local-assistant",
        role: "assistant",
        createdAt: "2026-07-28T20:02:00Z",
        blocks: [{ type: "text", text: "Earlier backend answer" }, { type: "structured_form" }],
      },
    ];

    const merged = mergeBackendHistory(local, [history[1]]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({
      ...local[0],
      backendMessageId: 2,
    });
    expect(merged[0]?.blocks[1]).toEqual({ type: "structured_form" });
  });

  test("does not duplicate messages on repeated synchronization", () => {
    const first = mergeBackendHistory([], history);
    const second = mergeBackendHistory(first, history);

    expect(second).toBe(first);
    expect(second).toHaveLength(2);
  });

  test("keeps repeated messages distinct by claiming each local match once", () => {
    const repeatedHistory: ChatHistoryMessage[] = [
      { ...history[0], messageId: 10, content: "Same text" },
      { ...history[0], messageId: 11, content: "Same text" },
    ];
    const local: ChatMessage[] = [
      {
        id: "local-user",
        role: "user",
        createdAt: "2026-07-28T20:01:00Z",
        blocks: [{ type: "text", text: "Same text" }],
      },
    ];

    const merged = mergeBackendHistory(local, repeatedHistory);

    expect(merged).toHaveLength(2);
    expect(merged.map((message) => message.backendMessageId)).toEqual([10, 11]);
  });
});
