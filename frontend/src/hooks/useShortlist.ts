import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Grant } from "@/types";

const KEY_SHORTLIST = "gi.shortlist.v1";

export interface SavedGrant {
  id: string;
  title: string;
  programme: string;
  fundingAmount: string;
  deadline: string;
  sourceUrl: string;
  savedAt: string;
}

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

export function parseShortlist(raw: string | null): ShortlistStore {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const store: ShortlistStore = {};
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
    return false;
  }
}

const subscribers = new Set<(store: ShortlistStore) => void>();

export function toSavedGrant(grant: Grant, savedAt: string): SavedGrant {
  return {
    id: grant.id,
    title: grant.title,
    programme: grant.programme ?? grant.source ?? "",
    fundingAmount: grant.fundingAmount ?? "",
    deadline: grant.deadline ?? "",
    sourceUrl: grant.sourceUrl ?? "",
    savedAt,
  };
}

export function useShortlist() {
  const [store, setStore] = useState<ShortlistStore>({});
  const [hydrated, setHydrated] = useState(false);
  const [persistenceOk, setPersistenceOk] = useState(true);
  const bootstrappedRef = useRef(false);
  const storeRef = useRef<ShortlistStore>({});

  const applyStore = useCallback((next: ShortlistStore, persist: boolean) => {
    storeRef.current = next;
    setStore(next);
    if (!persist) return;
    setPersistenceOk(saveStore(next));
    for (const notify of subscribers) notify(next);
  }, []);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    applyStore(loadStore(), false);
    setHydrated(true);
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

  const toggleSave = useCallback(
    (grant: Grant) => {
      const next = { ...storeRef.current };
      if (next[grant.id]) delete next[grant.id];
      else next[grant.id] = toSavedGrant(grant, new Date().toISOString());
      applyStore(next, true);
    },
    [applyStore],
  );

  const isSaved = useCallback((grantId: string) => grantId in store, [store]);

  const savedGrants = useMemo(
    () => Object.values(store).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    [store],
  );

  return { savedGrants, isSaved, toggleSave, hydrated, persistenceOk };
}
