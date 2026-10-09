import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, type ChatMessage } from "@/lib/api";

/** Where the conversation lived before it moved to the server; only ever cleaned up now. */
const LEGACY_STORAGE_KEY = "bloom_learn_chat";

export function useLearnChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /** Loads the conversation the server has stored for this user, so it follows them across devices. */
  useEffect(() => {
    let isUnmounted = false;
    api
      .listChatMessages()
      .then((result) => {
        if (isUnmounted) return;
        setMessages(result.messages.map(({ role, content }) => ({ role, content })));
      })
      .catch(() => {
        if (!isUnmounted) toast.error("Couldn't load your conversation");
      })
      .finally(() => {
        if (!isUnmounted) setIsLoadingHistory(false);
      });
    return () => {
      isUnmounted = true;
    };
  }, []);

  /**
   * Follows the streamed reply by scrolling the messages container itself — not the
   * window — so the page never jumps. Only auto-scrolls when the user is already near
   * the bottom, so scrolling up to re-read an earlier answer isn't fought mid-stream.
   */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 120) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  /**
   * Sends a message and streams the reply. Pass `overrideText` to send a suggested prompt directly.
   * Only the new message is sent: the server already holds the earlier turns and stores this
   * exchange itself once the reply finishes.
   */
  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    // Waiting for the stored conversation avoids it landing on top of a message sent meanwhile.
    if (!text || streaming || isLoadingHistory) return;
    if (overrideText === undefined) setInput("");

    setMessages((previous) => [
      ...previous,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch("/api/learn/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) {
        // Surface the server's own message (e.g. the 503 when Ollama is down) instead of a generic one.
        const serverMessage = (await res.text().catch(() => "")).trim();
        updateLastAssistant(serverMessage || "Sorry, something went wrong. Please try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      }
    } catch (error) {
      const wasStopped = error instanceof DOMException && error.name === "AbortError";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            // Keep whatever streamed before a stop; only fall back to a note if nothing arrived.
            content: wasStopped
              ? last.content || "_Stopped._"
              : "Sorry, something went wrong. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
    }
  }

  /** Replaces the current (last) assistant message's content — used for error/status text. */
  function updateLastAssistant(content: string) {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.role === "assistant") {
        updated[updated.length - 1] = { ...last, content };
      }
      return updated;
    });
  }

  /** Cancels an in-progress generation, keeping any text that already streamed in. */
  function stopGeneration() {
    abortControllerRef.current?.abort();
  }

  /**
   * Empties the chat window once the server has deleted the conversation, and removes the copy
   * older versions of Bloom kept in this browser so nothing of it is left behind.
   */
  function resetConversation() {
    abortControllerRef.current?.abort();
    setMessages([]);
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // localStorage unavailable — there is no legacy copy to remove.
    }
  }

  /** Sends on Enter (Shift+Enter inserts a newline). */
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return {
    messages,
    isLoadingHistory,
    input,
    setInput,
    streaming,
    messagesContainerRef,
    textareaRef,
    sendMessage,
    handleKeyDown,
    stopGeneration,
    resetConversation,
  };
}
