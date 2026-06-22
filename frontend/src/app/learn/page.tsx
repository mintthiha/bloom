"use client";
import { useState, useRef, useEffect } from "react";
import { useDashboardView } from "@/components/dashboard-view-provider";
import { ChatSection } from "./_components/_aiChat/ChatSection";
import { LearningCards } from "./_components/_cardsSection/LearningCards";
import { LearnPageSkeleton } from "./_components/_learnSkeleton/LearnPageSkeleton";
import { useLearnChat } from "@/hooks/useLearnChat";
import { setLearnPageExplored } from "@/app/_components/_onboardingChecklist/onboarding-storage";
import {
  getExploredCardIndices,
  markCardExplored,
} from "./_components/_cardsSection/learn-progress";
import { LearnProgressBar } from "./_components/_cardsSection/LearnProgressBar";
import { CARDS } from "./_components/_cardsSection/LearningCards";

export default function LearnPage() {
  const { effectiveView } = useDashboardView();
  const isDouble = effectiveView === "double";

  /**
   * Read the stored layout synchronously so the skeleton uses the correct column count
   * immediately — the context provider reads localStorage in a useEffect, which is too
   * late and would always render the wrong skeleton layout on first paint.
   * Also checks viewport width so mobile never shows a two-column skeleton.
   */
  const [skeletonIsDouble] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      if (window.innerWidth < 768) return false;
      return window.localStorage.getItem("bloom_dashboard_view") !== "single";
    } catch {
      return true;
    }
  });

  /** Drive skeleton visibility with a short timer so it is guaranteed to be painted. */
  const [isLoading, setIsLoading] = useState(true);

  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [exploredCardIndices, setExploredCardIndices] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    return getExploredCardIndices();
  });

  /** Marks a card as explored in localStorage and updates local state. */
  function handleCardExplored(index: number) {
    markCardExplored(index);
    setExploredCardIndices((previous) => new Set([...previous, index]));
  }

  const nextUnexploredCard = CARDS.find((_, i) => !exploredCardIndices.has(i)) ?? null;

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
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  /** Records that the user has visited the Learn page so the onboarding checklist can mark that step done. */
  useEffect(() => {
    setLearnPageExplored();
  }, []);

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
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "6px" }}>Learn</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Understand the financial concepts that shape your money.
        </p>
      </div>

      {isLoading ? (
        <LearnPageSkeleton isDouble={skeletonIsDouble} />
      ) : isDouble ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <LearnProgressBar
              exploredCount={exploredCardIndices.size}
              totalCount={CARDS.length}
              nextCardTitle={nextUnexploredCard?.title ?? null}
            />
            <LearningCards
              isDouble={isDouble}
              expandedCard={expandedCard}
              setExpandedCard={setExpandedCard}
              exploredCardIndices={exploredCardIndices}
              onCardExplored={handleCardExplored}
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
          <LearnProgressBar
            exploredCount={exploredCardIndices.size}
            totalCount={CARDS.length}
            nextCardTitle={nextUnexploredCard?.title ?? null}
          />
          <LearningCards
            isDouble={isDouble}
            expandedCard={expandedCard}
            setExpandedCard={setExpandedCard}
            exploredCardIndices={exploredCardIndices}
            onCardExplored={handleCardExplored}
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
        Bloom AI provides general financial education only — not personalized financial advice.
        Consult a licensed advisor for your specific situation.
      </p>
    </div>
  );
}
