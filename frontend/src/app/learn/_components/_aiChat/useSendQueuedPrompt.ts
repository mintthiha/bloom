import { useEffect, useRef } from "react";
import { takeQueuedAskBloomPrompt } from "@/lib/ask-bloom-handoff";

type UseSendQueuedPromptOptions = {
  /** True once the chat is on screen and its stored conversation has loaded. */
  isReady: boolean;
  sendMessage: (overrideText: string) => void;
  /** Brought into view after sending — in the single-column layout the chat sits below the cards. */
  chatElementRef: React.RefObject<HTMLElement | null>;
};

/**
 * Sends the question a dashboard card's "Ask Bloom" button queued, once the chat is ready. Checks
 * the queue a single time per visit: sending earlier would be dropped by the chat while its history
 * loads, and checking again would be a wasted storage read on every render.
 */
export function useSendQueuedPrompt({
  isReady,
  sendMessage,
  chatElementRef,
}: UseSendQueuedPromptOptions) {
  const hasCheckedQueueRef = useRef(false);

  /** Takes the queued question as soon as the chat is ready, sends it, and scrolls the chat into view. */
  useEffect(() => {
    if (!isReady || hasCheckedQueueRef.current) return;
    hasCheckedQueueRef.current = true;

    const queuedPrompt = takeQueuedAskBloomPrompt();
    if (!queuedPrompt) return;

    sendMessage(queuedPrompt);
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    chatElementRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [isReady, sendMessage, chatElementRef]);
}
