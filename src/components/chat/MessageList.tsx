import { useEffect, useRef, useState } from "react";
import { Compass, User } from "lucide-react";
import type { ChatBlock, ChatMessage } from "@/types";
import { BlockRenderer, type BlockCallbacks } from "./BlockRenderer";

interface Props {
  messages: ChatMessage[];
  callbacks: BlockCallbacks;
}

function summariseForAnnouncement(blocks: ChatBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "text":
        case "question":
          return b.text;
        case "structured_form":
          return "Please complete the organisation profile form.";
        case "research_status":
          return b.state.error
            ? `Research failed: ${b.state.error}`
            : "Researching grants.";
        case "grant_results":
          return `${b.grants.length} matching grants found.`;
        case "document":
          return "Application draft ready.";
        case "error":
          return b.message;
        case "success":
          return b.message;
      }
    })
    .filter(Boolean)
    .join(" ");
}

export function MessageList({ messages, callbacks }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAnnouncedId = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (last.id === lastAnnouncedId.current) return;
    lastAnnouncedId.current = last.id;
    setAnnouncement(summariseForAnnouncement(last.blocks));
  }, [messages]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
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
                <Compass className="h-4 w-4" />
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
