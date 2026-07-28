import type { ChatHistoryMessage } from "./ChatService";
import type { ChatMessage } from "@/types";

function containsBackendText(message: ChatMessage, content: string): boolean {
  return message.blocks.some(
    (block) =>
      (block.type === "text" || block.type === "question") &&
      block.text === content,
  );
}

function timestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Merge persisted plain-text backend history into the richer locally stored
 * message list. Existing forms, grant cards, errors, and document blocks are
 * retained. Matching local text messages are tagged with their backend ID,
 * while genuinely missing backend messages are restored as text blocks.
 */
export function mergeBackendHistory(
  localMessages: ChatMessage[],
  backendMessages: ChatHistoryMessage[],
): ChatMessage[] {
  if (backendMessages.length === 0) return localMessages;

  const merged = localMessages.map((message) => ({ ...message }));
  const claimedLocalIndexes = new Set<number>();
  let changed = false;

  for (const backendMessage of backendMessages) {
    let localIndex = merged.findIndex(
      (message) => message.backendMessageId === backendMessage.messageId,
    );

    if (localIndex < 0) {
      localIndex = merged.findIndex(
        (message, index) =>
          !claimedLocalIndexes.has(index) &&
          message.backendMessageId === undefined &&
          message.role === backendMessage.role &&
          containsBackendText(message, backendMessage.content),
      );
    }

    if (localIndex >= 0) {
      claimedLocalIndexes.add(localIndex);
      if (merged[localIndex].backendMessageId === undefined) {
        merged[localIndex] = {
          ...merged[localIndex],
          backendMessageId: backendMessage.messageId,
        };
        changed = true;
      }
      continue;
    }

    merged.push({
      id: `backend-${backendMessage.conversationId}-${backendMessage.messageId}`,
      backendMessageId: backendMessage.messageId,
      role: backendMessage.role,
      createdAt: backendMessage.createdAt,
      blocks: [{ type: "text", text: backendMessage.content }],
    });
    claimedLocalIndexes.add(merged.length - 1);
    changed = true;
  }

  if (!changed) return localMessages;

  return merged
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      const leftTime = timestamp(left.message.createdAt);
      const rightTime = timestamp(right.message.createdAt);
      if (leftTime === undefined || rightTime === undefined || leftTime === rightTime) {
        return left.index - right.index;
      }
      return leftTime - rightTime;
    })
    .map(({ message }) => message);
}
