"use client";
import { useState } from "react";
import { AiSuggestPanel } from "./_components/_aiSuggest/AiSuggestPanel";
import { CategorizationRulesManager } from "./_components/_categorizationRules/CategorizationRulesManager";
import { useIsMobile } from "@/hooks/use-mobile";

/** Page that combines AI-powered category suggestions with the user's saved categorization rules. */
export default function AutoCategorizePage() {
  const [rulesRefreshTrigger, setRulesRefreshTrigger] = useState(0);
  const isMobile = useIsMobile();

  /** Increments the refresh trigger so CategorizationRulesManager re-fetches its list. */
  function handleRuleAdded() {
    setRulesRefreshTrigger((prev) => prev + 1);
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px" }}>
      <div className="fade-up" style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          </svg>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
            }}
          >
            Auto-categorize
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          Let AI suggest categories for your merchants, then save them as rules for automatic
          categorization during import and manual entry.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        <div className="fade-up fade-up-2">
          <AiSuggestPanel onRuleAdded={handleRuleAdded} />
        </div>
        <div className="fade-up fade-up-3">
          <CategorizationRulesManager refreshTrigger={rulesRefreshTrigger} />
        </div>
      </div>
    </div>
  );
}
