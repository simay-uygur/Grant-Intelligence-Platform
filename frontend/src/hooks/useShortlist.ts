import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Grant } from "@/types";
import { ApiGrantService } from "@/services/ApiGrantService";

/**
 * Dedicated, versioned key. Separate from every other key in the app —
 * conversations ("gi.conversations.v1" / "gi.activeConversationId.v1"), theme
 * ("gi.theme.v1"), applications ("gi.applications.v1"), and drafts
 * ("gi.drafts.v1") — none of which this hook reads or writes.
 */
const KEY_SHORTLIST = "gi.shortlist.v1";

/**
 * A saved grant is stored as its own small snapshot rather than as a pointer
 * into the conversation that surfaced it: shortlists outlive conversations,
 * and a saved grant whose conversation has been deleted must still be
 * displayable and actionable on its own. `sourceUrl` is part of that — without
 * it a saved entry is a dead end.
 */
export interface SavedGrant {
  id: string;
  title: string;
  /** The funding programme / body behind the call. */
  programme: string;
  fundingAmount: string;
  deadline: string;
  sourceUrl: string;
  /** ISO timestamp, so a later shortlist view can order by recency. */
  savedAt: string;
  matchPercentage?: number;
  whyItMatches?: string;
  matchReasons?: string[];
  grant?: Grant;
}

/** Keyed by grant id: O(1) membership, and saving twice can't duplicate. */
type ShortlistStore = Record<string, SavedGrant>;

function isSavedGrant(value: unknown): value is SavedGrant {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === "string" &&
    typeof g.title === "string" &&
    typeof g.programme === "string" &&
    typeof g.fundingAmount === "string" &&
    typeof g.deadline === "string" &&
    typeof g.sourceUrl === "string" &&
    typeof g.savedAt === "string"
  );
}

/**
 * Anything missing, unparseable, or wrong-shaped resolves to an empty
 * shortlist. Split from the storage read so the rules are testable without a
 * browser — a saved grant is not worth crashing the results list over. Pure.
 */
export function parseShortlist(raw: string | null): ShortlistStore {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const store: ShortlistStore = {};
    // Per-entry validation: one corrupt record drops itself, not the shortlist.
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (isSavedGrant(entry)) store[id] = entry;
    }
    return store;
  } catch {
    return {};
  }
}

function loadStore(): ShortlistStore {
  if (typeof window === "undefined") return {};
  try {
    return parseShortlist(window.localStorage.getItem(KEY_SHORTLIST));
  } catch {
    return {};
  }
}

/** Returns whether the write actually succeeded, so callers can surface a status if needed. */
function saveStore(store: ShortlistStore): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (Object.keys(store).length === 0) {
      window.localStorage.removeItem(KEY_SHORTLIST);
      return true;
    }
    window.localStorage.setItem(KEY_SHORTLIST, JSON.stringify(store));
    return true;
  } catch {
    // Reachable in practice: storage disabled (some private-browsing modes),
    // or the quota is full. Nothing to invent here — just report it.
    return false;
  }
}

/**
 * A conversation can hold more than one grant_results block, so more than one
 * GrantResults — and therefore more than one copy of this hook — can be on
 * screen at once. Without this, saving a grant in one block would leave the
 * other block's bookmark icon stale until a reload. The writer broadcasts the
 * new store; every other live instance adopts it without re-saving.
 */
const subscribers = new Set<(store: ShortlistStore) => void>();

export function toSavedGrant(grant: Grant, savedAt: string): SavedGrant {
  return {
    id: grant.id,
    title: grant.title,
    programme: grant.programme ?? "",
    fundingAmount: grant.fundingAmount ?? "",
    deadline: grant.deadline ?? "",
    sourceUrl: grant.sourceUrl ?? "",
    savedAt,
    matchPercentage: grant.matchPercentage,
    whyItMatches: grant.whyItMatches,
    matchReasons: grant.matchReasons,
    grant,
  };
}

// TODO(api): entirely local (React state + localStorage), like useApplications
// and useDrafts. With a backend this would become GET/PUT /shortlist — see
// docs/api-contract.md.
export function useShortlist() {
  const [store, setStore] = useState<ShortlistStore>({});
  const [hydrated, setHydrated] = useState(false);
  // Reflects the most recent write attempt only — a later successful write
  // (once storage is available again) clears it automatically.
  const [persistenceOk, setPersistenceOk] = useState(true);
  const bootstrappedRef = useRef(false);
  // Mirrors `store` synchronously so a toggle reads the current value without
  // doing work inside a setState updater — StrictMode double-invokes those,
  // which would mean two writes and two broadcasts per click.
  const storeRef = useRef<ShortlistStore>({});

  const applyStore = useCallback((next: ShortlistStore, persist: boolean) => {
    storeRef.current = next;
    setStore(next);
    if (!persist) return;
    setPersistenceOk(saveStore(next));
    for (const notify of subscribers) notify(next);
  }, []);

  // Idempotent bootstrap: run once, in-effect, guarded against StrictMode.
  // Reading in an effect rather than a lazy initialiser keeps the first client
  // render identical to the server's, so SSR can't mismatch.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    applyStore(loadStore(), false);
    setHydrated(true);

    const api = new ApiGrantService();
    api.listSavedGrants().then((backendGrants) => {
      if (Array.isArray(backendGrants) && backendGrants.length > 0) {
        const merged: ShortlistStore = { ...storeRef.current };
        for (const item of backendGrants) {
          merged[item.id] = {
            id: item.id,
            title: item.title,
            programme: item.programme || "",
            fundingAmount: item.fundingAmount || "",
            deadline: item.deadline || "",
            sourceUrl: item.sourceUrl || "",
            savedAt: item.savedAt || new Date().toISOString(),
            matchPercentage: item.matchPercentage,
            whyItMatches: item.whyItMatches,
            grant: item.grant,
          };
        }
        applyStore(merged, true);
      }
    }).catch(() => {});
  }, [applyStore]);

  useEffect(() => {
    const onBroadcast = (next: ShortlistStore) => {
      storeRef.current = next;
      setStore(next);
    };
    subscribers.add(onBroadcast);
    return () => {
      subscribers.delete(onBroadcast);
    };
  }, []);

  /**
   * Saves an unsaved grant, removes a saved one, and writes straight away —
   * syncing both to local storage and SQLite DB.
   */
  const toggleSave = useCallback(
    (grant: Grant) => {
      const next = { ...storeRef.current };
      const isSaving = !next[grant.id];
      if (next[grant.id]) {
        delete next[grant.id];
      } else {
        next[grant.id] = toSavedGrant(grant, new Date().toISOString());
      }
      applyStore(next, true);

      const api = new ApiGrantService();
      if (isSaving) {
        api.saveGrant(grant).catch(() => {});
      } else {
        api.deleteSavedGrant(grant.id).catch(() => {});
      }
    },
    [applyStore],
  );

  const isSaved = useCallback((grantId: string) => grantId in store, [store]);

  /** Newest first, so a future shortlist view has a sensible default order. */
  const savedGrants = useMemo(
    () => Object.values(store).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    [store],
  );

  return { savedGrants, isSaved, toggleSave, hydrated, persistenceOk };
}
