import type { Conversation } from "@/types";
import type { DemoApplication } from "@/data/mockApplications";

export interface ApplicationLink {
  /** The conversation this application came from, if it can still be found. */
  conversationId: string | null;
  /** True only when that conversation's CURRENT document is this application's draft. */
  hasLiveDraft: boolean;
  /** Plain-language explanation, shown whenever an action is unavailable. */
  reason: string | null;
}

/**
 * Works out what a pipeline card can actually link back to. Pure, so the rules
 * are testable and so nothing here can offer a link that doesn't exist.
 *
 * A chat-created application's id is `app-${doc.id}`, which supports two
 * different lookups:
 *
 * - The DRAFT is only openable while it is still the conversation's current
 *   document — Conversation.document is singular, so starting another
 *   application in the same conversation replaces it.
 * - The CONVERSATION is found through the transcript instead: the
 *   `{type:"document"}` block stays in the message history for good, so the
 *   source conversation remains reachable even after its draft was replaced.
 *
 * Demo-seeded applications match neither, and say so rather than offering a
 * button that would land somewhere broken.
 */
export function resolveApplicationLink(
  application: DemoApplication,
  conversations: Conversation[],
): ApplicationLink {
  const documentId = application.id.startsWith("app-") ? application.id.slice(4) : null;

  if (documentId) {
    const live = conversations.find((c) => c.document?.id === documentId);
    if (live) return { conversationId: live.id, hasLiveDraft: true, reason: null };

    const source = conversations.find((c) =>
      c.messages.some((m) =>
        m.blocks.some((b) => b.type === "document" && b.documentId === documentId),
      ),
    );
    if (source) {
      // The conversation's current document IS the newer application, so its
      // grant title is already in hand — naming it turns "something replaced
      // this" into "this is what replaced it". No extra lookup.
      const replacedBy = source.document?.grantTitle;
      return {
        conversationId: source.id,
        hasLiveDraft: false,
        reason: replacedBy
          ? `A newer application (${replacedBy}) replaced this draft, so it can no longer be opened. You can still open the conversation below.`
          : "A newer application replaced this draft, so it can no longer be opened. You can still open the conversation below.",
      };
    }
  }

  return {
    conversationId: null,
    hasLiveDraft: false,
    reason: application.id.startsWith("app-demo-")
      ? "Demo application — it wasn't created from a conversation, so there's no draft to open."
      : "The conversation that created this application is no longer available.",
  };
}
