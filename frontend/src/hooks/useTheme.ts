import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  type Theme,
  applyResolvedTheme,
  getStoredTheme,
  storeTheme,
} from "@/lib/theme";

/**
 * Theme state (light / dark) with localStorage persistence.
 *
 * Starts as the default on the server and first client render (so SSR markup
 * matches and there's no hydration mismatch), then hydrates from storage in
 * an effect. The actual `dark` class is already set pre-paint by the inline
 * script in __root, so there's no theme flash; this hook keeps it in sync
 * afterwards.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  useEffect(() => {
    applyResolvedTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    storeTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      storeTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}
