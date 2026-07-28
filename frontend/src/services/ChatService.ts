import type { OrganisationProfile } from "@/types";

export interface BackendConversation {
  conversationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatReply {
  conversationId: string;
  assistantMessage: string;
  nextStep: string;
  followUpQuestions: string[];
  toolResults: Array<Record<string, unknown>>;
}

export interface ChatHistoryMessage {
  messageId: number;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface SendChatMessageInput {
  conversationId: string;
  sessionId: string;
  userMessage: string;
  profile?: OrganisationProfile;
}

export interface ChatService {
  createConversation(): Promise<BackendConversation>;
  sendMessage(input: SendChatMessageInput): Promise<ChatReply>;
  getMessages(conversationId: string): Promise<ChatHistoryMessage[]>;
}
