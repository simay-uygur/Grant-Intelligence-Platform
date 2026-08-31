import { useEffect, useRef, useState } from "react";
import type { ChatBlock, ChatMessage } from "@/types";
import type { BlockCallbacks } from "./BlockRenderer";
import { ChatMessageItem } from "./ChatMessageItem";
import { ProcessingIndicator } from "./ProcessingIndicator";
import { visibleChatBlocks } from "./chatReplyBlocks";

interface Props {
  messages: ChatMessage[];
  callbacks: BlockCallbacks;
  showProcessingIndicator?: boolean;
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
          return b.state.error ? `Research failed: ${b.state.error}` : "Researching grants.";
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

export function MessageList({ messages, callbacks, showProcessingIndicator }: Props) {
  const lastAnnouncedId = useRef<string | null>(null);
  const wasProcessing = useRef(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (last.id === lastAnnouncedId.current) return;
    lastAnnouncedId.current = last.id;
    setAnnouncement(summariseForAnnouncement(visibleChatBlocks(last.blocks)));
  }, [messages]);

  useEffect(() => {
    if (showProcessingIndicator && !wasProcessing.current) {
      setAnnouncement("Grant Intelligence is working on a response.");
    }
    wasProcessing.current = Boolean(showProcessingIndicator);
  }, [showProcessingIndicator]);

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 py-8">
      {/* Gives the message blocks' own h3 titles (research status, grant
          results, application draft) a non-skipped ancestor under the
          page's h1 — otherwise a screen reader's heading list jumps from
          h1 straight to h3. */}
      <h2 className="sr-only">Conversation</h2>
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
      <ul className="space-y-6">
        {messages.map((m) => (
          <ChatMessageItem key={m.id} message={m} callbacks={callbacks} />
        ))}
        {showProcessingIndicator && <ProcessingIndicator />}
      </ul>
    </div>
  );
}
