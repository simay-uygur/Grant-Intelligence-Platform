import { useEffect, useRef, useState } from "react";
import type { ChatBlock, ChatMessage } from "@/types";
import type { BlockCallbacks } from "./BlockRenderer";
import { ChatMessageItem } from "./ChatMessageItem";

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
          <ChatMessageItem key={m.id} message={m} callbacks={callbacks} />
        ))}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}
