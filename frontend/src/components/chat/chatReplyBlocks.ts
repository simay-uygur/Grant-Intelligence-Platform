import type { ChatReply } from "@/services/ChatService";
import type { ChatBlock } from "@/types";

/**
 * Convert the backend chat contract into renderable blocks.
 *
 * Profile collection is represented by the structured form, so rendering the
 * backend's follow-up questions beside it would ask for the same facts twice.
 */
export function chatReplyBlocks(reply: ChatReply, includeProfileForm = false): ChatBlock[] {
  const blocks: ChatBlock[] = [{ type: "text", text: reply.assistantMessage }];
  if (!includeProfileForm && reply.nextStep !== "collect_information") {
    blocks.push(
      ...reply.followUpQuestions.map((question): ChatBlock => ({
        type: "question",
        text: question,
      })),
    );
  }
  return blocks;
}
