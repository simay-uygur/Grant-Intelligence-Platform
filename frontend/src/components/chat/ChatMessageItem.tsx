import { useState } from "react";
import { Check, Compass, Copy, RotateCcw, User } from "lucide-react";
import { format } from "date-fns";
import type { ChatBlock, ChatMessage } from "frontend/src/types";
import { cn } from "frontend/src/lib/utils";
import { Button } from "frontend/src/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "frontend/src/components/ui/tooltip";
import { BlockRenderer, type BlockCallbacks } from "./BlockRenderer";

interface Props {
  message: ChatMessage;
  callbacks: BlockCallbacks;
}

function getCopyableText(blocks: ChatBlock[]): string {
  return blocks
    .filter(
      (b): b is Extract<ChatBlock, { type: "text" | "question" }> =>
        b.type === "text" || b.type === "question",
    )
    .map((b) => b.text)
    .join("\n\n")
    .trim();
}

function hasRetryableError(blocks: ChatBlock[]): boolean {
  return blocks.some((b) => b.type === "research_status" && Boolean(b.state.error));
}

function formatTime(createdAt: string): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "HH:mm");
}

export function ChatMessageItem({ message, callbacks }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const copyText = getCopyableText(message.blocks);
  const canRetry = hasRetryableError(message.blocks);
  const time = formatTime(message.createdAt);

  const handleCopy = async () => {
    if (!copyText || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable in this browser/context — silently ignore */
    }
  };

  return (
    <li className={cn("flex flex-col gap-1.5", isUser && "items-end")}>
      {/* Slack/Discord-style header row above the bubble, identical for both
          speakers on every screen size. DOM order is always [avatar, name,
          time] so screen readers read the name then the time; the user side
          is visually mirrored with flex-row-reverse to sit [time, name,
          avatar] alongside its right-aligned bubble. */}
      <div
        className={cn(
          "flex max-w-full items-center gap-1.5 text-[11px] font-medium text-muted-foreground",
          isUser && "flex-row-reverse",
        )}
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            isUser ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand",
          )}
        >
          {isUser ? <User className="h-3 w-3" /> : <Compass className="h-3 w-3" />}
        </span>
        <span className="truncate">{isUser ? "You" : "Grant Intelligence"}</span>
        {time && <span className="shrink-0 text-muted-foreground/70">{time}</span>}
      </div>

      <div
        className={cn(
          "min-w-0",
          isUser && "max-w-[85%] rounded-xl bg-muted px-3.5 py-2.5 sm:max-w-[75%]",
        )}
      >
        <div className="space-y-3">
          {message.blocks.map((b, i) => (
            <BlockRenderer key={i} block={b} callbacks={callbacks} isUser={isUser} />
          ))}
        </div>
      </div>

      {!isUser && (copyText || canRetry) && (
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1">
            {copyText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCopy}
                    aria-label={copied ? "Copied to clipboard" : "Copy message"}
                    className="h-auto w-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{copied ? "Copied" : "Copy"}</TooltipContent>
              </Tooltip>
            )}
            {canRetry && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={callbacks.onRetryResearch}
                    aria-label="Retry research"
                    className="h-auto w-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Retry</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      )}
    </li>
  );
}
