import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * JS-visible reduced-motion preference. Every other animation in this app
 * is a CSS keyframe/transition gated with the `motion-safe:` Tailwind
 * variant, which needs no JS. A word-by-word text reveal is a timed JS
 * loop (see useProgressiveReveal), so CSS alone can't skip it — this is
 * the one place that needs to know the preference directly.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
