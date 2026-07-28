import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation } from "frontend/src/types";

// How close to the bottom (in px) counts as "at the bottom" for stick-to-bottom scrolling.
const NEAR_BOTTOM_THRESHOLD = 96;

/**
 * Keeps the message list stuck to the bottom as new content streams in,
 * without yanking the view away from an intentional upward scroll.
 *
 * - Force-scrolls (instantly) on a conversation switch.
 * - Force-scrolls (smoothly) when the user's own message lands.
 * - Otherwise only auto-scrolls if the user was already near the bottom;
 *   if they'd scrolled up, surfaces `showScrollButton` instead.
 *
 * `extraTrigger` lets a caller fold in additional "new content" signals
 * (e.g. a processing indicator toggling) that don't change `active` itself.
 */
export function useStickToBottomScroll(active: Conversation | null, extraTrigger?: unknown) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollBottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const prevConversationId = useRef<string | null>(null);
  const prevLastMessageId = useRef<string | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    scrollBottomRef.current?.scrollIntoView({ behavior, block: "end" });
    setShowScrollButton(false);
  }, []);

  // Track whether the user is scrolled near the bottom of the message list,
  // so we know whether to stick new content to the bottom or leave it be.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = distance < NEAR_BOTTOM_THRESHOLD;
      if (isNearBottomRef.current) setShowScrollButton(false);
    };
    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on new messages/blocks/research progress/processing state —
  // but only force it to the bottom for the user's own message or a
  // conversation switch. Otherwise respect an intentional upward scroll and
  // surface the "scroll to latest" button instead.
  useEffect(() => {
    if (!active) return;
    const last = active.messages[active.messages.length - 1];
    const conversationChanged = prevConversationId.current !== active.id;
    const isNewUserMessage =
      !conversationChanged && last?.role === "user" && last.id !== prevLastMessageId.current;
    prevConversationId.current = active.id;
    prevLastMessageId.current = last?.id ?? null;

    if (conversationChanged || isNewUserMessage) {
      isNearBottomRef.current = true;
      scrollToBottom(conversationChanged ? "auto" : "smooth");
    } else if (isNearBottomRef.current) {
      scrollToBottom("smooth");
    } else {
      setShowScrollButton(true);
    }
  }, [active, extraTrigger, scrollToBottom]);

  return { scrollContainerRef, scrollBottomRef, showScrollButton, scrollToBottom };
}
