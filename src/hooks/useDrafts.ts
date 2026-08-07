import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplicationDocument } from "@/types";

/**
 * UNSAVED EDIT BUFFER — semantics
 *
 * The committed application document already survives a reload inside
 * "gi.conversations.v1" (useConversations persists it). What did not survive
 * was in-progress text: the editor's `drafts` map is component state, so a
 * refresh mid-sentence lost the sentence. This hook adds only that missing
 * layer, under its own key, and never reads or writes the conversation keys.
 *
 * - The buffer is stored per document id, separate from the committed doc.
 * - Writes are DEBOUNCED (500ms) so typing doesn't hammer localStorage.
 * - The buffer is CLEARED for a section when the user Saves (the text has
 *   folded into the committed document) or Cancels (the text was discarded).
 *   Both are flushed immediately rather than debounced — see flush().
 * - ON RESTORE, per section:
 *     · buffer text === committed text  → drop it silently, nothing was lost.
 *     · buffer text !== committed text, and the committed text is unchanged
 *       since the buffer was written → restore it and mark the editor dirty.
 *     · buffer text !== committed text AND the committed text has changed
 *       since the buffer was written → still restore the buffer, but report
 *       the section as a CONFLICT so the UI can say so. Neither version is
 *       discarded without the user seeing a signal.
 *   "Changed since" is detected per section with a stored hash of the text
 *   the buffer was based on — per section rather than the document's
 *   updatedAt, because saving section A bumps updatedAt and would otherwise
 *   raise a false conflict on untouched section B.
 * - Undo is deliberately NOT part of this: `lastRewrite` stays in memory, so
 *   a restored buffer never resurrects or overwrites an undo step (see the
 *   note in ApplicationDocument.tsx).
 */
const KEY_DRAFTS = "gi.drafts.v1";

const DEBOUNCE_MS = 500;

/** Buffers for older documents are pruned so the key can't grow forever. */
const MAX_DOCUMENTS = 20;

interface DraftEntry {
  text: string;
  /** Hash of the committed text this draft was based on. */
  baseHash: string;
}

interface DocumentBuffer {
  savedAt: string;
  sections: Record<string, DraftEntry>;
}

type DraftStore = Record<string, DocumentBuffer>;

export interface DraftRestore {
  /** sectionId -> text to put back into the editor. */
  sections: Record<string, string>;
  /** Sections whose committed text moved on since the buffer was written. */
  conflictSectionIds: string[];
}

/** FNV-1a — small, stable, and enough to spot "this text changed". */
function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function isDraftEntry(value: unknown): value is DraftEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.text === "string" && typeof entry.baseHash === "string";
}

function isDocumentBuffer(value: unknown): value is DocumentBuffer {
  if (typeof value !== "object" || value === null) return false;
  const buffer = value as Record<string, unknown>;
  if (typeof buffer.savedAt !== "string") return false;
  if (typeof buffer.sections !== "object" || buffer.sections === null) return false;
  return Object.values(buffer.sections as Record<string, unknown>).every(isDraftEntry);
}

/** Anything unparseable, wrong-shaped, or unreadable resolves to "no buffers". */
function loadStore(): DraftStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY_DRAFTS);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const store: DraftStore = {};
    for (const [docId, buffer] of Object.entries(parsed as Record<string, unknown>)) {
      if (isDocumentBuffer(buffer)) store[docId] = buffer;
    }
    return store;
  } catch {
    return {};
  }
}

/** Returns whether the write actually succeeded, so callers can surface a status if needed. */
function saveStore(store: DraftStore): boolean {
  if (typeof window === "undefined") return true;
  try {
    const entries = Object.entries(store);
    // Newest first, then capped: a long-lived browser shouldn't accumulate
    // buffers for every application ever opened.
    const pruned = entries
      .sort((a, b) => b[1].savedAt.localeCompare(a[1].savedAt))
      .slice(0, MAX_DOCUMENTS);
    if (pruned.length === 0) {
      window.localStorage.removeItem(KEY_DRAFTS);
      return true;
    }
    window.localStorage.setItem(KEY_DRAFTS, JSON.stringify(Object.fromEntries(pruned)));
    return true;
  } catch {
    // Reachable in practice: storage disabled (some private-browsing modes),
    // or the quota is full. Nothing to invent here — just report it.
    return false;
  }
}

/**
 * Mirrors the editor's in-progress `drafts` map into localStorage and hands
 * back whatever was there on load.
 *
 * `drafts` stays owned by the component — this hook only observes it, so
 * there is one source of truth for what the user is typing.
 */
export function useDrafts(doc: ApplicationDocument, drafts: Record<string, string>) {
  const [hydrated, setHydrated] = useState(false);
  const [restore, setRestore] = useState<DraftRestore | null>(null);
  // Reflects the most recent write attempt only — a later successful write
  // (once storage is available again) clears it automatically.
  const [persistenceOk, setPersistenceOk] = useState(true);
  const bootstrappedFor = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The write is deferred, so it needs the values as they were when it was
  // scheduled, not as they are when it fires.
  const pendingRef = useRef<{ docId: string; drafts: Record<string, string> } | null>(null);
  const sectionsRef = useRef(doc.sections);
  sectionsRef.current = doc.sections;

  const writeNow = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const sections: Record<string, DraftEntry> = {};
    for (const [sectionId, text] of Object.entries(pending.drafts)) {
      const committed = sectionsRef.current.find((s) => s.id === sectionId)?.content ?? "";
      sections[sectionId] = { text, baseHash: hashText(committed) };
    }
    const store = loadStore();
    if (Object.keys(sections).length === 0) delete store[pending.docId];
    else store[pending.docId] = { savedAt: new Date().toISOString(), sections };
    setPersistenceOk(saveStore(store));
  }, []);

  /**
   * Writes any pending change straight away. Used for Save and Cancel: after
   * a Cancel the buffer must not outlive the discarded text even briefly,
   * or a reload inside the debounce window would resurrect it.
   */
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    writeNow();
  }, [writeNow]);

  // Idempotent bootstrap, re-run if the document changes. Reading in an
  // effect (not a lazy initialiser) keeps the first client render identical
  // to the server's; the ref guard makes StrictMode's double-invoke a no-op.
  useEffect(() => {
    if (bootstrappedFor.current === doc.id) return;
    bootstrappedFor.current = doc.id;
    setHydrated(false);
    setRestore(null);

    const buffer = loadStore()[doc.id];
    if (buffer) {
      const sections: Record<string, string> = {};
      const conflictSectionIds: string[] = [];
      for (const [sectionId, entry] of Object.entries(buffer.sections)) {
        const section = doc.sections.find((s) => s.id === sectionId);
        // A section that no longer exists has nothing to restore into.
        if (!section) continue;
        if (entry.text === section.content) continue; // already committed
        sections[sectionId] = entry.text;
        if (entry.baseHash !== hashText(section.content)) conflictSectionIds.push(sectionId);
      }
      if (Object.keys(sections).length > 0) setRestore({ sections, conflictSectionIds });
    }
    setHydrated(true);
  }, [doc.id, doc.sections]);

  // Mirror `drafts` into the buffer, debounced. Gated on `hydrated` so the
  // empty initial map can't wipe the buffer before it has been read.
  useEffect(() => {
    if (!hydrated) return;
    pendingRef.current = { docId: doc.id, drafts };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      writeNow();
    }, DEBOUNCE_MS);
  }, [doc.id, drafts, hydrated, writeNow]);

  // Without this, a reload inside the debounce window would still drop the
  // last few keystrokes. localStorage writes are synchronous, so flushing
  // here completes before the page goes away. `pagehide` rather than
  // `beforeunload`: it also fires when a mobile browser backgrounds the tab,
  // which `beforeunload` misses.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPageHide = () => flush();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flush]);

  // On unmount, FLUSH rather than cancel. Unmounting is routine here —
  // switching conversation or view tears this component down — and cancelling
  // would drop up to 500ms of typing, which is the exact loss this hook
  // exists to prevent. Writing the last known text is always the safer side.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      writeNow();
    };
  }, [writeNow]);

  return { hydrated, restore, persistenceOk, flush };
}
