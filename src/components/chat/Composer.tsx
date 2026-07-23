import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg";

export function Composer({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    setAttachedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = "";
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        {attachedFile && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-100/60 px-3 py-2 text-xs text-amber-900">
            <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="break-words font-medium [overflow-wrap:anywhere]">
                {attachedFile.name}
              </span>
              <p className="mt-0.5 text-amber-800/90">
                Selected locally only — not uploaded or analysed. Document
                processing requires backend integration.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAttachedFile(null)}
              aria-label="Remove attached file"
              className="shrink-0 rounded-md p-1 text-amber-800 hover:bg-amber-200/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/20">
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach a file (PDF, DOC, DOCX, TXT, MD, PNG, JPG, JPEG). Selected locally only, not uploaded."
            title="Attach a file — selected locally only, not uploaded"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              placeholder ?? "Describe your organisation and funding needs…"
            }
            disabled={disabled}
            className="min-w-0 max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 px-1 text-[11px] text-muted-foreground">
          Mock mode • Responses use local demo data. Not legal or financial
          advice.
        </div>
      </div>
    </div>
  );
}
