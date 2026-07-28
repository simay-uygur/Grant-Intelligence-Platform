import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionState =
  | "idle"
  | "starting"
  | "listening"
  | "stopping"
  | "processing"
  | "unsupported"
  | "permission-denied"
  | "error";

interface UseSpeechRecognitionOptions {
  /** Called with the final recognised transcript for one recording session. */
  onResult: (transcript: string) => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

const RUNNING_STATES: SpeechRecognitionState[] = [
  "starting",
  "listening",
  "stopping",
  "processing",
];

/**
 * Thin wrapper around the browser's Web Speech API (SpeechRecognition /
 * webkitSpeechRecognition). Feature detection only happens client-side, in
 * an effect, so server-rendered and first-client-render markup match —
 * mirrors the pattern used by useIsMobile in this codebase.
 *
 * TODO(api): if the team later replaces browser speech recognition with a
 * server-side transcription service (see docs/api-contract.md, "Voice
 * transcription"), that's a different hook — recording audio and POSTing
 * it, awaiting a transcript — not a drop-in swap here. Composer only
 * depends on this hook's returned `state`/`start`/`stop`/`onResult` shape,
 * so a replacement hook with the same shape could substitute cleanly.
 */
export function useSpeechRecognition({ onResult }: UseSpeechRecognitionOptions) {
  const [state, setState] = useState<SpeechRecognitionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ctorRef = useRef<SpeechRecognitionCtor | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    ctorRef.current = getSpeechRecognitionCtor();
    if (!ctorRef.current) setState("unsupported");
  }, []);

  // Detach handlers before aborting so no event can update state after
  // this component (and this hook instance) has unmounted.
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      }
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = ctorRef.current;
    if (!Ctor) return;
    // A session is already starting, listening, stopping, or finishing up —
    // never start a second one on top of it.
    if (RUNNING_STATES.includes(state)) return;

    setErrorMessage(null);
    const recognition = new Ctor();
    recognition.lang =
      (typeof document !== "undefined" && document.documentElement.lang) ||
      (typeof navigator !== "undefined" && navigator.language) ||
      "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event) => {
      setState("processing");
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) transcript += result[0].transcript;
      }
      const trimmed = transcript.trim();
      if (trimmed) onResultRef.current(trimmed);
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setState("permission-denied");
      } else if (event.error === "aborted") {
        // Caused by our own stop()/unmount abort() — not a user-facing error.
      } else {
        setErrorMessage(event.error);
        setState("error");
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setState((s) => (s === "permission-denied" || s === "error" ? s : "idle"));
    };

    recognitionRef.current = recognition;
    setState("starting");
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setState("error");
      setErrorMessage("not-startable");
    }
  }, [state]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    setState("stopping");
    recognitionRef.current.stop();
  }, []);

  return {
    state,
    errorMessage,
    start,
    stop,
    supported: state !== "unsupported",
  };
}
