import { useCallback, useEffect, useState } from "react";

const AUTH_KEY = "gi.auth.v1";

/**
 * MOCK AUTH — frontend-only demo gate, not real authentication. Any
 * non-empty email + password "signs in" (see LoginPage); this hook just
 * remembers that choice across reloads via localStorage, the same way
 * useConversations/useShortlist persist their own state.
 *
 * `hydrated` follows useConversations's pattern exactly: starts false so
 * server and first client render agree (no localStorage on the server),
 * then flips true in a client-only effect once the real value is known —
 * avoids a hydration mismatch and an authed→login flash on reload.
 */
export function useAuth() {
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setAuthed(window.localStorage.getItem(AUTH_KEY) === "1");
    } catch {
      setAuthed(false);
    }
    setHydrated(true);
  }, []);

  const signIn = useCallback(() => {
    setAuthed(true);
    try {
      window.localStorage.setItem(AUTH_KEY, "1");
    } catch {
      // Unavailable storage (e.g. private browsing) — the session still
      // works for this tab; it just won't survive a reload.
    }
  }, []);

  const signOut = useCallback(() => {
    setAuthed(false);
    try {
      window.localStorage.removeItem(AUTH_KEY);
    } catch {
      // Nothing to do — auth state is already cleared in memory.
    }
  }, []);

  return { authed, hydrated, signIn, signOut };
}
