import type {
  BackendConversation,
  ChatHistoryMessage,
  ChatReply,
  ChatService,
  SendChatMessageInput,
} from "./ChatService";
import { ApiClient } from "./apiClient";
import {
  buildChatMessageRequest,
  parseChatHistory,
  parseChatReply,
  parseConversation,
} from "./chatApi";

export class ApiChatService implements ChatService {
  constructor(private readonly client: ApiClient) {}

  async createConversation(): Promise<BackendConversation> {
    const payload = await this.client.request<unknown>("/api/v1/chat/conversations", {
      method: "POST",
    });
    return parseConversation(payload);
  }

  async sendMessage(input: SendChatMessageInput): Promise<ChatReply> {
    const payload = await this.client.request<unknown>("/api/v1/chat/message", {
      method: "POST",
      body: JSON.stringify(buildChatMessageRequest(input)),
    });
    return parseChatReply(payload);
  }

  async getMessages(conversationId: string): Promise<ChatHistoryMessage[]> {
    const payload = await this.client.request<unknown>(
      `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    );
    return parseChatHistory(payload);
  }
}
