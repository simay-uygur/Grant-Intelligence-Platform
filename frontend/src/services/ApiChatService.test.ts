import { expect, test } from "bun:test";
import { ApiChatService } from "./ApiChatService";
import { ApiClient } from "./apiClient";

test("creates a backend conversation, sends a message, and reads history", async () => {
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (url.endsWith("/chat/conversations") && init?.method === "POST") {
      return Response.json({
        conversation_id: "backend-1",
        created_at: "2026-07-28T20:00:00Z",
        updated_at: "2026-07-28T20:00:00Z",
      });
    }
    if (url.endsWith("/chat/message")) {
      return Response.json({
        conversation_id: "backend-1",
        assistant_message: "Backend assistant reply",
        next_step: "collect_information",
        follow_up_questions: [],
        tool_results: [],
      });
    }
    return Response.json({
      conversation_id: "backend-1",
      messages: [
        {
          message_id: 1,
          conversation_id: "backend-1",
          role: "user",
          content: "Hello",
          created_at: "2026-07-28T20:01:00Z",
        },
      ],
    });
  };
  const service = new ApiChatService(
    new ApiClient("http://127.0.0.1:8000", fetchImpl),
  );

  const conversation = await service.createConversation();
  const reply = await service.sendMessage({
    conversationId: conversation.conversationId,
    sessionId: "local-1",
    userMessage: "Hello",
  });
  const history = await service.getMessages(conversation.conversationId);

  expect(conversation.conversationId).toBe("backend-1");
  expect(reply.assistantMessage).toBe("Backend assistant reply");
  expect(history[0]?.content).toBe("Hello");
  expect(requests.map(({ url, method }) => ({ url, method }))).toEqual([
    {
      url: "http://127.0.0.1:8000/api/v1/chat/conversations",
      method: "POST",
    },
    {
      url: "http://127.0.0.1:8000/api/v1/chat/message",
      method: "POST",
    },
    {
      url: "http://127.0.0.1:8000/api/v1/chat/conversations/backend-1/messages",
      method: "GET",
    },
  ]);
});

test("URL-encodes backend conversation IDs when reading history", async () => {
  let requestedUrl = "";
  const service = new ApiChatService(
    new ApiClient("http://127.0.0.1:8000", async (input) => {
      requestedUrl = String(input);
      return Response.json({
        conversation_id: "backend/conversation with spaces",
        messages: [],
      });
    }),
  );

  await expect(
    service.getMessages("backend/conversation with spaces"),
  ).resolves.toEqual([]);
  expect(requestedUrl).toBe(
    "http://127.0.0.1:8000/api/v1/chat/conversations/backend%2Fconversation%20with%20spaces/messages",
  );
});
