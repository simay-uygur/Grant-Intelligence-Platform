import { useCallback, useEffect, useState } from "react";
import { AUTH_TOKEN_KEY, AUTH_UNAUTHORIZED_EVENT, logout } from "@/services/apiClient";

const AUTH_KEY = "gi.auth.v1";

export function useAuth() {
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const isAuthed =
        window.localStorage.getItem(AUTH_KEY) === "1" ||
        Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY));
      setAuthed(isAuthed);
    } catch {
      setAuthed(false);
    }
    setHydrated(true);

    const handleUnauthorized = () => {
      setAuthed(false);
      try {
        window.localStorage.removeItem(AUTH_KEY);
      } catch {
        // Storage unavailable
      }
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const signIn = useCallback(() => {
    setAuthed(true);
    try {
      window.localStorage.setItem(AUTH_KEY, "1");
    } catch {
      // Unavailable storage
    }
  }, []);

  const signOut = useCallback(() => {
    setAuthed(false);
    try {
      window.localStorage.removeItem(AUTH_KEY);
    } catch {
      // Storage unavailable
    }
    void logout();
  }, []);

  return { authed, hydrated, signIn, signOut };
}
