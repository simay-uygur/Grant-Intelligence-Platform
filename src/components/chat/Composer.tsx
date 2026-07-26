import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircleQuestion, Mic, Paperclip, Send, X } from "lucide-react";
import type { Grant } from "@/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

// Matches the textarea's max-h-40 (10rem) Tailwind class below.
const MAX_TEXTAREA_HEIGHT = 160;

// Only questions groundable in fields that always exist on a Grant.
const SUGGESTED_QUESTIONS = [
  "Am I eligible for this grant?",
  "What is the funding amount?",
  "When is the deadline?",
  "Why does this match my project?",
];

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
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = "";
  };

  const askSuggested = (question: string) => {
    if (disabled) return;
    onSend(question);
  };

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
                      className="h-auto w-auto shrink-0 rounded-md p-1 text-brand hover:bg-brand/15"
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
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
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
                    className="h-auto w-auto shrink-0 rounded-md p-1 text-warning hover:bg-warning/15"
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
                  aria-label="Voice input — not yet available"
                  className="shrink-0 rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Voice input — coming soon</TooltipContent>
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
