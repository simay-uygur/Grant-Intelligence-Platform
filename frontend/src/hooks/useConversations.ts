import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "@/storage/localStorage";
import { mergeBackendHistory } from "@/services/chatHistory";
import type { ChatHistoryMessage } from "@/services/ChatService";
import type {
  ApplicationDocument,
  ChatBlock,
  ChatMessage,
  Conversation,
  Grant,
  OrganisationProfile,
} from "@/types";

/** Upper bound on a stored title — a long sentence, not an essay. */
const MAX_TITLE_LENGTH = 200;

/**
 * The rename step, as a pure function over the conversation list, so the
 * data-safety properties can be asserted in a test rather than assumed:
 * only the target's `title` may differ, every other conversation comes back
 * by reference, and a rename that shouldn't happen returns the SAME array —
 * which means the persist effect never re-runs and storage isn't rewritten.
 */
export function applyRename(
  conversations: Conversation[],
  id: string,
  title: string,
): Conversation[] {
  const next = title.trim().slice(0, MAX_TITLE_LENGTH).trimEnd();
  if (!next) return conversations;
  const target = conversations.find((c) => c.id === id);
  if (!target || target.title === next) return conversations;
  return conversations.map((c) => (c.id === id ? { ...c, title: next } : c));
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function initialConversation(): Conversation {
  const id = uid();
  const now = new Date().toISOString();
  return {
    id,
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    stage: "welcome",
    messages: [
      {
        id: uid(),
        role: "assistant",
        createdAt: now,
        blocks: [
          {
            type: "text",
            text: "Hello! Tell me about your organisation and what kind of funding you are looking for.",
          },
        ],
      },
    ],
  };
}

// Structured UI blocks remain local because backend message history stores
// plain user/assistant text. In API mode, backendConversationId links this
// local conversation to the corresponding backend chat session.
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Reflects the most recent write attempt only — a later successful write
  // (once storage is available again) clears it automatically.
  const [persistenceOk, setPersistenceOk] = useState(true);
  const bootstrappedRef = useRef(false);

  // Idempotent bootstrap: run once, in-effect, guarded against StrictMode.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const existing = storage.loadConversations();
    if (existing.length === 0) {
      const first = initialConversation();
      setConversations([first]);
      setActiveId(first.id);
      storage.saveConversations([first]);
      storage.saveActiveId(first.id);
    } else {
      setConversations(existing);
      const savedActive = storage.loadActiveId();
      setActiveId(
        savedActive && existing.some((c) => c.id === savedActive) ? savedActive : existing[0].id,
      );
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) setPersistenceOk(storage.saveConversations(conversations));
  }, [conversations, hydrated]);
  useEffect(() => {
    if (hydrated) setPersistenceOk(storage.saveActiveId(activeId));
  }, [activeId, hydrated]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const updateActive = useCallback(
    (updater: (c: Conversation) => Conversation) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId ? { ...updater(c), updatedAt: new Date().toISOString() } : c,
        ),
      );
    },
    [activeId],
  );

  const newConversation = useCallback(() => {
    const c = initialConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  /**
   * Renames one conversation and nothing else.
   *
   * Deliberately not routed through updateActive: that targets whichever
   * conversation is active (rename works on any row) and force-bumps
   * updatedAt, whereas a rename must leave every other field exactly as it
   * was. Persistence is the existing effect — same key, same shape, same
   * safeWrite, so a failed write still just flips persistenceOk to false and
   * leaves React state intact.
   */
  const renameConversation = useCallback((id: string, title: string) => {
    setConversations((prev) => applyRename(prev, id, title));
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (activeId === id) {
          setActiveId(next[0]?.id ?? null);
        }
        return next;
      });
    },
    [activeId],
  );

  const appendMessage = useCallback(
    (message: ChatMessage) => {
      updateActive((c) => {
        const isFirstUser = message.role === "user" && !c.messages.some((m) => m.role === "user");
        const newTitle =
          isFirstUser && c.title === "New conversation"
            ? firstUserText(message).slice(0, 60) || c.title
            : c.title;
        return { ...c, messages: [...c.messages, message], title: newTitle };
      });
    },
    [updateActive],
  );

  const updateMessageBlocks = useCallback(
    (messageId: string, updater: ChatBlock[] | ((blocks: ChatBlock[]) => ChatBlock[])) => {
      const fn = typeof updater === "function" ? updater : () => updater;
      updateActive((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === messageId ? { ...m, blocks: fn(m.blocks) } : m)),
      }));
    },
    [updateActive],
  );

  const setStage = useCallback(
    (stage: Conversation["stage"]) => {
      updateActive((c) => ({ ...c, stage }));
    },
    [updateActive],
  );

  const setProfile = useCallback(
    (profile: OrganisationProfile) => {
      updateActive((c) => ({ ...c, profile }));
    },
    [updateActive],
  );

  const setBackendConversationId = useCallback(
    (backendConversationId: string) => {
      updateActive((c) => ({ ...c, backendConversationId }));
    },
    [updateActive],
  );

  const synchronizeBackendMessages = useCallback(
    (conversationId: string, messages: ChatHistoryMessage[]) => {
      setConversations((previous) => {
        let changed = false;
        const next = previous.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          const mergedMessages = mergeBackendHistory(conversation.messages, messages);
          if (mergedMessages === conversation.messages) return conversation;
          changed = true;
          return {
            ...conversation,
            messages: mergedMessages,
            updatedAt: new Date().toISOString(),
          };
        });
        return changed ? next : previous;
      });
    },
    [],
  );

  const setGrants = useCallback(
    (grants: Grant[]) => {
      updateActive((c) => ({ ...c, grants }));
    },
    [updateActive],
  );

  const setDocument = useCallback(
    (doc: ApplicationDocument | undefined, grantId?: string) => {
      updateActive((c) => ({ ...c, document: doc, selectedGrantId: grantId ?? c.selectedGrantId }));
    },
    [updateActive],
  );

  const updateDocumentSection = useCallback(
    (sectionId: string, content: string) => {
      updateActive((c) => {
        if (!c.document) return c;
        return {
          ...c,
          document: {
            ...c.document,
            sections: c.document.sections.map((s) => (s.id === sectionId ? { ...s, content } : s)),
            updatedAt: new Date().toISOString(),
          },
        };
      });
    },
    [updateActive],
  );

  return {
    hydrated,
    persistenceOk,
    conversations,
    activeConversation,
    activeId,
    newConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    appendMessage,
    updateMessageBlocks,
    setStage,
    setProfile,
    setBackendConversationId,
    synchronizeBackendMessages,
    setGrants,
    setDocument,
    updateDocumentSection,
    uid,
  };
}

function firstUserText(m: ChatMessage): string {
  const b = m.blocks.find((x) => x.type === "text");
  return b && b.type === "text" ? b.text : "";
}
