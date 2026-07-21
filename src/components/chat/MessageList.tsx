import { useEffect, useRef } from "react";
import { Sparkles, User } from "lucide-react";
import type { ChatMessage } from "@/types";
import { BlockRenderer, type BlockCallbacks } from "./BlockRenderer";

interface Props {
  messages: ChatMessage[];
  callbacks: BlockCallbacks;
}

export function MessageList({ messages, callbacks }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <ul className="space-y-6">
        {messages.map((m) => (
          <li key={m.id} className="flex gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                m.role === "assistant"
                  ? "bg-brand/10 text-brand"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {m.role === "assistant" ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {m.role === "assistant" ? "Grant Intelligence" : "You"}
              </div>
              {m.blocks.map((b, i) => (
                <BlockRenderer key={i} block={b} callbacks={callbacks} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}
