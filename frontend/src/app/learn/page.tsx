"use client";
import { useState, useRef, useEffect } from "react";
import { useDashboardView } from "@/components/dashboard-view-provider";
import { ChatSection } from "./_components/_aiChat/ChatSection";
import { LearningCards } from "./_components/_cardsSection/LearningCards";

type Message = { role: "user" | "assistant"; content: string };

export default function LearnPage() {
  const { view } = useDashboardView();
  const isDouble = view === "double";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/learn/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

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
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, something went wrong. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div
      style={{
        maxWidth: isDouble ? "1400px" : "900px",
        margin: "0 auto",
        padding: "32px 24px 80px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "36px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "6px" }}>
          Learn
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Understand the financial concepts that shape your money.
        </p>
      </div>

      {isDouble ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <LearningCards isDouble={isDouble} expandedCard={expandedCard} setExpandedCard={setExpandedCard} />
          </div>
          <div style={{ position: "sticky", top: "80px" }}>
            <ChatSection
              messages={messages}
              isDouble={isDouble}
              streaming={streaming}
              bottomRef={bottomRef}
              textAreaRef={textareaRef}
              input={input}
              setInput={setInput}
              sendMessage={sendMessage}
              handleKeyDown={handleKeyDown}
            />
          </div>
        </div>
      ) : (
        <>
          <LearningCards isDouble={isDouble} expandedCard={expandedCard} setExpandedCard={setExpandedCard} />
          <ChatSection
            messages={messages}
            isDouble={isDouble}
            streaming={streaming}
            bottomRef={bottomRef}
            textAreaRef={textareaRef}
            input={input}
            setInput={setInput}
            sendMessage={sendMessage}
            handleKeyDown={handleKeyDown}
          />
        </>
      )}

      <p
        style={{
          marginTop: "16px",
          fontSize: "11px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        Bloom AI provides general financial education only — not personalized
        financial advice. Consult a licensed advisor for your specific
        situation.
      </p>
    </div>
  );
}
