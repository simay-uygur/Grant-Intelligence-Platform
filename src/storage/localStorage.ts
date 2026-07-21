import type { Conversation } from "@/types";

const KEY_CONVERSATIONS = "gi.conversations.v1";
const KEY_ACTIVE = "gi.activeConversationId.v1";

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export const storage = {
  loadConversations(): Conversation[] {
    return safeRead<Conversation[]>(KEY_CONVERSATIONS, []);
  },
  saveConversations(conversations: Conversation[]) {
    safeWrite(KEY_CONVERSATIONS, conversations);
  },
  loadActiveId(): string | null {
    return safeRead<string | null>(KEY_ACTIVE, null);
  },
  saveActiveId(id: string | null) {
    safeWrite(KEY_ACTIVE, id);
  },
};
