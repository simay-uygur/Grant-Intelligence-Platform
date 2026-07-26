import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircleQuestion, Mic, Paperclip, Send, X } from "lucide-react";
import type { Grant } from "@/types";
import { cn } from "@/lib/utils";
import { useSpeechRecognition, type SpeechRecognitionState } from "@/hooks/useSpeechRecognition";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InlineNotice } from "@/components/common/InlineNotice";

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** The grant the user is currently asking about, if any — shown as a removable context chip. */
  grantContext?: Grant | null;
  onClearGrantContext?: () => void;
}

const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg";

// The `accept` attribute above is only a hint to the OS file picker — most
// pickers still let the user choose "All files", so this is genuinely
// reachable and worth validating rather than trusting the browser alone.
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg"];

// Matches the textarea's max-h-40 (10rem) Tailwind class below.
const MAX_TEXTAREA_HEIGHT = 160;

// Only questions groundable in fields that always exist on a Grant.
const SUGGESTED_QUESTIONS = [
  "Am I eligible for this grant?",
  "What is the funding amount?",
  "When is the deadline?",
  "Why does this match my project?",
];

const MIC_LABEL: Record<SpeechRecognitionState, string> = {
  idle: "Start voice input",
  starting: "Starting voice input…",
  listening: "Stop voice input — listening",
  stopping: "Stopping voice input…",
  processing: "Processing speech…",
  unsupported: "Voice input isn't supported in this browser",
  "permission-denied": "Microphone permission denied — click to try again",
  error: "Voice input error — click to try again",
};

const MIC_TOOLTIP: Record<SpeechRecognitionState, string> = {
  idle: "Voice input — uses your browser's built-in speech recognition, not a paid service",
  starting: "Starting…",
  listening: "Listening — click to stop",
  stopping: "Stopping…",
  processing: "Processing what you said…",
  unsupported: "Not supported in this browser — try Chrome or Edge on desktop or Android",
  "permission-denied": "Microphone access was denied — check your browser's site settings",
  error: "Voice input couldn't start — click to try again",
};

const MIC_STATUS_TEXT: Partial<Record<SpeechRecognitionState, string>> = {
  starting: "Starting microphone…",
  listening: "Listening — tap the microphone to stop.",
  stopping: "Stopping…",
  processing: "Processing speech…",
  "permission-denied":
    "Microphone permission denied. Check your browser's site settings and try again.",
  error: "Voice input couldn't start. Try again.",
};

export function Composer({
  value,
  onValueChange,
  onSend,
  disabled,
  placeholder,
  grantContext,
  onClearGrantContext,
}: Props) {
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Append (never overwrite) the recognised transcript into whatever is
  // already typed, with a separating space if needed.
  const speech = useSpeechRecognition({
    onResult: (transcript) => {
      onValueChange(
        value.trim().length > 0 ? `${value.replace(/\s+$/, "")} ${transcript}` : transcript,
      );
    },
  });

  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    onValueChange("");
    setAttachedFile(null);
    setAttachmentError(null);
  };

  // TODO(api): the selected File stays local only — see docs/api-contract.md
  // ("File upload") for the proposed POST /conversations/{id}/attachments
  // endpoint. Once that exists, a successful selection here would call it
  // through grantService (or a sibling service) and store the resulting
  // Attachment (src/types) rather than the raw File.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setAttachedFile(null);
      setAttachmentError(
        `"${file.name}" isn't a supported file type. Choose a PDF, Word, text, or image file instead.`,
      );
      return;
    }
    setAttachmentError(null);
    setAttachedFile(file);
  };

  const askSuggested = (question: string) => {
    if (disabled) return;
    onSend(question);
  };

  const handleMicClick = () => {
    if (disabled) return;
    if (speech.state === "listening") {
      speech.stop();
    } else if (
      speech.state === "idle" ||
      speech.state === "error" ||
      speech.state === "permission-denied"
    ) {
      speech.start();
    }
    // starting / stopping / processing / unsupported: ignore extra clicks.
  };

  const showSpeechStatus = speech.state !== "idle" && speech.state !== "unsupported";

  const effectivePlaceholder = grantContext
    ? `Ask about "${grantContext.title}"…`
    : (placeholder ?? "Describe your organisation and funding needs…");

  return (
    <TooltipProvider delayDuration={300}>
      <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          {grantContext && (
            <div className="mb-2 space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs">
                <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0 text-brand" />
                <span className="min-w-0 flex-1 truncate text-brand">
                  Asking about:{" "}
                  <span className="font-medium" title={grantContext.title}>
                    {grantContext.title}
                  </span>
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onClearGrantContext}
                      aria-label={`Stop asking about ${grantContext.title}`}
                      className="h-auto w-auto shrink-0 rounded-md p-1.5 text-brand hover:bg-brand/15"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Remove grant context</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => askSuggested(q)}
                    disabled={disabled}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showSpeechStatus && (
            <div
              role="status"
              aria-live="polite"
              className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  speech.state === "listening" && "bg-destructive motion-safe:animate-pulse",
                  (speech.state === "permission-denied" || speech.state === "error") &&
                    "bg-destructive",
                  (speech.state === "starting" ||
                    speech.state === "stopping" ||
                    speech.state === "processing") &&
                    "bg-brand motion-safe:animate-pulse",
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">{MIC_STATUS_TEXT[speech.state]}</span>
              {speech.state === "listening" && (
                <button
                  type="button"
                  onClick={speech.stop}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  Stop
                </button>
              )}
            </div>
          )}

          {attachmentError && (
            <InlineNotice tone="error" className="mb-2">
              {attachmentError}
            </InlineNotice>
          )}

          {attachedFile && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" title={attachedFile.name}>
                  {attachedFile.name}
                </p>
                <p className="mt-0.5 text-warning/90">
                  Selected locally only — not uploaded or analysed. Document processing requires
                  backend integration.
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setAttachedFile(null)}
                    aria-label="Remove attached file"
                    className="h-auto w-auto shrink-0 rounded-md p-1.5 text-warning hover:bg-warning/15"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Remove attachment</TooltipContent>
              </Tooltip>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-sm focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/20">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileChange}
              disabled={disabled}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach a file (PDF, DOC, DOCX, TXT, MD, PNG, JPG, JPEG). Selected locally only, not uploaded."
                  className="shrink-0 rounded-lg text-muted-foreground hover:bg-muted"
                  disabled={disabled}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Attach a file</TooltipContent>
            </Tooltip>
            <label htmlFor="composer-textarea" className="sr-only">
              Message
            </label>
            <textarea
              id="composer-textarea"
              ref={ref}
              rows={1}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={effectivePlaceholder}
              disabled={disabled}
              className="min-h-[44px] max-h-40 min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground placeholder:leading-snug disabled:opacity-60"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleMicClick}
                  disabled={disabled}
                  aria-pressed={speech.state === "listening"}
                  aria-label={MIC_LABEL[speech.state]}
                  className={cn(
                    "relative shrink-0 rounded-lg text-muted-foreground hover:bg-muted",
                    speech.state === "listening" &&
                      "text-destructive hover:bg-destructive/10 hover:text-destructive",
                    (speech.state === "permission-denied" || speech.state === "error") &&
                      "text-destructive",
                    speech.state === "unsupported" && "opacity-50",
                  )}
                >
                  {speech.state === "listening" && (
                    <span
                      className="absolute inset-1 rounded-full bg-destructive/25 motion-safe:animate-ping"
                      aria-hidden="true"
                    />
                  )}
                  {speech.state === "starting" || speech.state === "processing" ? (
                    <Loader2 className="relative h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className="relative h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{MIC_TOOLTIP[speech.state]}</TooltipContent>
            </Tooltip>
            <div className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  onClick={submit}
                  disabled={disabled || !value.trim()}
                  aria-label="Send message"
                  className="shrink-0 rounded-lg bg-brand text-white shadow-sm hover:bg-brand/90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Send message</TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-2 px-1 text-[11px] text-muted-foreground">
            Mock mode • Responses use local demo data. Not legal or financial advice.
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
