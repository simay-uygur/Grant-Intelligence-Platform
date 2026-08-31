import type { ChatReply } from "@/services/ChatService";
import type { ChatBlock } from "@/types";

/**
 * Convert the backend chat contract into renderable blocks.
 *
 * Profile collection is represented by the structured form, so rendering the
 * backend's follow-up questions beside it would ask for the same facts twice.
 */
export function chatReplyBlocks(reply: ChatReply): ChatBlock[] {
  const blocks: ChatBlock[] = [{ type: "text", text: reply.assistantMessage }];
  if (reply.nextStep !== "collect_information") {
    blocks.push(
      ...reply.followUpQuestions.map((question): ChatBlock => ({
        type: "question",
        text: question,
      })),
    );
  }
  return blocks;
}

/**
 * Retains all message blocks so natural conversational answers and guidance
 * are always visible alongside interactive cards and widgets.
 */
export function visibleChatBlocks(blocks: ChatBlock[]): ChatBlock[] {
  return blocks;
}
