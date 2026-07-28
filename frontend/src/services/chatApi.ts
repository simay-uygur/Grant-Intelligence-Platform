import { z } from "zod";
import type {
  BackendConversation,
  ChatHistoryMessage,
  ChatReply,
  SendChatMessageInput,
} from "./ChatService";

const conversationResponseSchema = z.object({
  conversation_id: z.string().min(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

const chatMessageResponseSchema = z.object({
  conversation_id: z.string().min(1),
  assistant_message: z.string(),
  next_step: z.string(),
  follow_up_questions: z.array(z.string()),
  tool_results: z.array(z.record(z.unknown())),
});

const conversationMessagesResponseSchema = z.object({
  conversation_id: z.string().min(1),
  messages: z.array(
    z.object({
      message_id: z.number().int(),
      conversation_id: z.string().min(1),
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      created_at: z.string().min(1),
    }),
  ),
});

export class ChatApiContractError extends Error {
  constructor() {
    super("The chat backend returned data that did not match the expected schema.");
    this.name = "ChatApiContractError";
  }
}

function parseWithContract<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ChatApiContractError();
  return parsed.data;
}

export function buildChatMessageRequest(input: SendChatMessageInput) {
  const profile = input.profile;
  return {
    conversation_id: input.conversationId,
    session_id: input.sessionId,
    user_message: input.userMessage,
    ...(profile
      ? {
          context: {
            organization_type: profile.organisationType || undefined,
            country: profile.country || undefined,
            budget_range: profile.fundingAmount || undefined,
            project_goal:
              profile.projectDescription ||
              profile.projectTitle ||
              profile.organisationDescription ||
              undefined,
          },
        }
      : {}),
  };
}

export function parseConversation(payload: unknown): BackendConversation {
  const response = parseWithContract(conversationResponseSchema, payload);
  return {
    conversationId: response.conversation_id,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

export function parseChatReply(payload: unknown): ChatReply {
  const response = parseWithContract(chatMessageResponseSchema, payload);
  return {
    conversationId: response.conversation_id,
    assistantMessage: response.assistant_message,
    nextStep: response.next_step,
    followUpQuestions: response.follow_up_questions,
    toolResults: response.tool_results,
  };
}

export function parseChatHistory(payload: unknown): ChatHistoryMessage[] {
  const response = parseWithContract(conversationMessagesResponseSchema, payload);
  return response.messages.map((message) => ({
    messageId: message.message_id,
    conversationId: message.conversation_id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
  }));
}
