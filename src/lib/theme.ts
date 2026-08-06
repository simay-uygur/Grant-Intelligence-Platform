// Theme mode handling. Deliberately self-contained and independent of
// src/storage/localStorage.ts — it uses its own dedicated key and never
// reads or writes the conversation keys ("gi.conversations.v1" /
// "gi.activeConversationId.v1").

export type Theme = "light" | "dark";

/** Dedicated, versioned key — separate from the conversation storage keys. */
export const THEME_STORAGE_KEY = "gi.theme.v1";

const THEMES: readonly Theme[] = ["light", "dark"];

/** Older builds also persisted "system"; it is migrated to the default on read. */
const LEGACY_SYSTEM_VALUE = "system";

export const DEFAULT_THEME: Theme = "light";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Reads the stored theme, defaulting to "light" when nothing is stored or
 * storage is unavailable. A legacy "system" value from the old three-state
 * build is migrated in place: it resolves to "light" and is rewritten so the
 * stale value doesn't linger.
 */
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
    if (stored === LEGACY_SYSTEM_VALUE) storeTheme(DEFAULT_THEME);
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable (e.g. private browsing / quota) — theme just won't persist */
  }
}

/** Adds/removes the `dark` class on <html>, which activates the existing .dark design tokens. */
export function applyResolvedTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/**
 * Synchronous, dependency-free snippet injected into the document <head> so
 * the correct `dark` class is set BEFORE first paint — preventing a
 * light→dark flash on load under SSR. Mirrors the logic above but must stay
 * self-contained (it runs as a raw inline script, not a module). Anything
 * other than an exact "dark" — including the legacy "system" value — is light.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var r=document.documentElement;if(t==='dark')r.classList.add('dark');else r.classList.remove('dark');}catch(e){}})();`;
