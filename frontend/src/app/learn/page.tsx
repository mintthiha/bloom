"use client";
import { useState, useRef, useEffect } from "react";
import { useDashboardView } from "@/components/dashboard-view-provider";
import { ChatSection } from "./_components/_aiChat/ChatSection";
import { LearningCards } from "./_components/_cardsSection/LearningCards";
import { useLearnChat } from "@/hooks/useLearnChat";

export default function LearnPage() {
  const { view } = useDashboardView();
  const isDouble = view === "double";
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const {
    messages,
    input,
    setInput,
    streaming,
    bottomRef,
    textareaRef,
    sendMessage,
    handleKeyDown,
  } = useLearnChat();

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
            <LearningCards
              isDouble={isDouble}
              expandedCard={expandedCard}
              setExpandedCard={setExpandedCard}
            />
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
          <LearningCards
            isDouble={isDouble}
            expandedCard={expandedCard}
            setExpandedCard={setExpandedCard}
          />
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
