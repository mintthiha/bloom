import { useEffect, useRef, useState } from "react";
import {
  clearStoredMessages,
  loadStoredMessages,
  saveStoredMessages,
  type ChatMessage,
} from "@/app/learn/_components/_aiChat/chat-storage";

export function useLearnChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    typeof window === "undefined" ? [] : loadStoredMessages()
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  /** Persists the conversation once it settles (not on every streamed token) so it survives reloads. */
  useEffect(() => {
    if (!streaming) saveStoredMessages(messages);
  }, [messages, streaming]);

  /** Sends a message and streams the reply. Pass `overrideText` to send a suggested prompt directly. */
  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;
    if (overrideText === undefined) setInput("");

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch("/api/learn/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
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

  /** Clears the conversation from the screen and from localStorage, stopping any active stream. */
  function clearConversation() {
    abortControllerRef.current?.abort();
    setMessages([]);
    clearStoredMessages();
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
    input,
    setInput,
    streaming,
    messagesContainerRef,
    textareaRef,
    sendMessage,
    handleKeyDown,
    stopGeneration,
    clearConversation,
  };
}
