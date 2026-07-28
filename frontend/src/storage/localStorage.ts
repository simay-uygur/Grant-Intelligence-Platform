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

/** Returns whether the write actually succeeded, so callers can surface a status if needed. */
function safeWrite(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Reachable in practice: storage disabled (some private-browsing modes),
    // or the quota is full. Nothing to invent here — just report it.
    return false;
  }
}

export const storage = {
  loadConversations(): Conversation[] {
    return safeRead<Conversation[]>(KEY_CONVERSATIONS, []);
  },
  saveConversations(conversations: Conversation[]): boolean {
    return safeWrite(KEY_CONVERSATIONS, conversations);
  },
  loadActiveId(): string | null {
    return safeRead<string | null>(KEY_ACTIVE, null);
  },
  saveActiveId(id: string | null): boolean {
    return safeWrite(KEY_ACTIVE, id);
  },
};
