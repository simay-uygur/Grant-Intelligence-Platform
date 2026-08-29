import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface RevealState {
  /** The `text` value this state belongs to — how a change is detected. */
  forText: string | undefined;
  revealed: string | undefined;
}

function initialRevealFor(text: string | undefined, reduceMotion: boolean): RevealState {
  return { forText: text, revealed: text === undefined || reduceMotion ? text : "" };
}

/**
 * REVEAL, not generation — `text` always arrives complete (from the mock's
 * already-resolved rewriteSection call, or a fully-composed chat message);
 * this hook only controls how much of it is shown at once, client-side, to
 * read as "being written" rather than popping in. It has no opinion on
 * anything else: the caller commits/saves/announces the full `text`
 * immediately and independently of this hook's progress.
 *
 * `text === undefined` means "nothing to reveal" — no timer, `revealed` is
 * undefined. A defined `text` that differs from the previous call restarts
 * the reveal from empty. `onComplete` fires exactly once per distinct
 * `text` value: immediately under prefers-reduced-motion, or when the
 * animation finishes otherwise — so a caller can use it to stop treating
 * this text as "in flight" either way.
 */
export function useProgressiveReveal(text: string | undefined, onComplete?: () => void) {
  const reduceMotion = usePrefersReducedMotion();
  const [state, setState] = useState(() => initialRevealFor(text, reduceMotion));

  // Reset synchronously DURING render (React's documented pattern for
  // "adjust state when a prop changes"), not in an effect. By the time
  // `text` changes here, the caller has already committed the full new
  // content elsewhere (see DocumentWorkspace's commitSection) — so an
  // effect-based reset would let one render slip through still showing the
  // OLD `revealed` value falling back to that already-updated content,
  // flashing the complete text for a frame before it visibly clears and
  // re-types. This keeps the very first painted frame already correct.
  if (state.forText !== text) {
    setState(initialRevealFor(text, reduceMotion));
  }

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref so a caller passing a fresh arrow function each render doesn't
  // restart the effect below — only a genuinely new `text` should do that.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (text === undefined) return;

    if (reduceMotion) {
      onCompleteRef.current?.();
      return;
    }

    // Word-by-word, keeping whitespace (including the mock's blank lines
    // between paragraphs) as its own tokens so the reconstructed prefix is
    // byte-identical to a substring of the real text at every step.
    const tokens = text.split(/(\s+)/);
    const total = tokens.length;
    // A few hundred ms total regardless of length, so a long section
    // doesn't drag and a short one doesn't feel instant-but-different.
    const durationMs = Math.min(600, Math.max(200, total * 12));
    const stepMs = Math.max(16, durationMs / total);
    let shown = 0;

    timerRef.current = setInterval(() => {
      shown += 1;
      if (shown >= total) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setState({ forText: text, revealed: text });
        onCompleteRef.current?.();
      } else {
        setState({ forText: text, revealed: tokens.slice(0, shown).join("") });
      }
    }, stepMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, reduceMotion]);

  return {
    revealed: state.revealed,
    streaming: state.revealed !== undefined && state.revealed !== text,
  };
}
