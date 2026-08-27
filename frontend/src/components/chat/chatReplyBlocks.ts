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
 * Older saved conversations may contain assistant text and question blocks
 * beside the blank onboarding form. The form already communicates the whole
 * next step, so keep only the card and any non-text status/error blocks.
 */
export function visibleChatBlocks(blocks: ChatBlock[]): ChatBlock[] {
  const hasBlankProfileForm = blocks.some(
    (block) => block.type === "structured_form" && block.profile === undefined,
  );
  if (!hasBlankProfileForm) return blocks;
  return blocks.filter((block) => block.type !== "text" && block.type !== "question");
}
