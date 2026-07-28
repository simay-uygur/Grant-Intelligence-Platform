import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "frontend/src/storage/localStorage";
import type {
  ApplicationDocument,
  ChatBlock,
  ChatMessage,
  Conversation,
  Grant,
  OrganisationProfile,
} from "frontend/src/types";

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

// TODO(api): this hook is entirely local (React state + localStorage). Once
// a backend exists, conversations/messages would sync through it instead —
// see docs/api-contract.md ("Conversations" and "Chat") for the proposed
// POST /conversations and POST /conversations/{id}/messages endpoints. That
// would mean this hook (or a service it calls into) fetching/pushing
// through grantService-style calls rather than storage directly; not done
// now since no backend exists yet.
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
    (messageId: string, updater: (blocks: ChatBlock[]) => ChatBlock[]) => {
      updateActive((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId ? { ...m, blocks: updater(m.blocks) } : m,
        ),
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

  const setGrants = useCallback(
    (grants: Grant[]) => {
      updateActive((c) => ({ ...c, grants }));
    },
    [updateActive],
  );

  const setDocument = useCallback(
    (doc: ApplicationDocument, grantId: string) => {
      updateActive((c) => ({ ...c, document: doc, selectedGrantId: grantId }));
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
    deleteConversation,
    appendMessage,
    updateMessageBlocks,
    setStage,
    setProfile,
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
