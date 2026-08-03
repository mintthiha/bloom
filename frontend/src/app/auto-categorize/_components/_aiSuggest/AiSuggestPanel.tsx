"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { inputStyle } from "@/lib/styles/input";

interface AiSuggestion {
  merchant: string;
  category: string;
}

interface AiSuggestPanelProps {
  onRuleAdded: () => void;
}

/** Panel that lets users paste merchant names and get AI-powered category suggestions. */
export function AiSuggestPanel({ onRuleAdded }: AiSuggestPanelProps) {
  const [merchantInput, setMerchantInput] = useState("");
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingMerchant, setAddingMerchant] = useState<string | null>(null);
  const [isAddingAll, setIsAddingAll] = useState(false);

  /** Parses the textarea input into a deduplicated list of non-empty merchant names. */
  function parseMerchants(): string[] {
    return [
      ...new Set(
        merchantInput
          .split(/[\n,]+/)
          .map((name) => name.trim())
          .filter(Boolean)
      ),
    ].slice(0, 20);
  }

  /** Sends the merchant list to Claude and populates the suggestions list. */
  async function handleSuggest() {
    const merchants = parseMerchants();
    if (merchants.length === 0) return;
    setIsLoading(true);
    setSuggestions([]);
    try {
      const result = await api.suggestCategories(merchants);
      setSuggestions(result.suggestions);
      if (result.suggestions.length === 0) {
        toast.error("No suggestions returned — try different merchant names");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI suggestion failed");
    } finally {
      setIsLoading(false);
    }
  }

  /** Saves all current suggestions as rules in parallel and notifies the parent once. */
  async function handleAddAll() {
    if (suggestions.length === 0) return;
    setIsAddingAll(true);
    const results = await Promise.allSettled(
      suggestions.map((s) => api.upsertCategorizationRule(s.merchant, s.category))
    );
    const savedCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.length - savedCount;
    if (savedCount > 0) {
      setSuggestions([]);
      onRuleAdded();
      toast.success(`${savedCount} rule${savedCount !== 1 ? "s" : ""} saved`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} rule${failedCount !== 1 ? "s" : ""} couldn't be saved`);
    }
    setIsAddingAll(false);
  }

  /** Saves a suggested merchant → category pair as a rule and notifies the parent. */
  async function handleAddRule(suggestion: AiSuggestion) {
    setAddingMerchant(suggestion.merchant);
    try {
      await api.upsertCategorizationRule(suggestion.merchant, suggestion.category);
      toast.success(`Rule saved: ${suggestion.merchant} → ${suggestion.category}`);
      setSuggestions((prev) => prev.filter((s) => s.merchant !== suggestion.merchant));
      onRuleAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save rule");
    } finally {
      setAddingMerchant(null);
    }
  }

  const merchantCount = parseMerchants().length;
  const canSuggest = merchantCount > 0 && !isLoading;

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
        <h2 style={{ fontSize: "18px", fontWeight: 700 }}>AI suggestions</h2>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
        Enter merchant names and Bloom will suggest the right category for each one.
      </p>

      <textarea
        value={merchantInput}
        onChange={(e) => setMerchantInput(e.target.value)}
        placeholder={"Loblaws\nNetflix\nShell"}
        disabled={isLoading}
        rows={5}
        style={{
          ...inputStyle,
          width: "100%",
          resize: "vertical",
          fontFamily: "inherit",
          lineHeight: 1.6,
          boxSizing: "border-box",
        }}
      />
      <p
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          marginTop: "6px",
          marginBottom: "16px",
        }}
      >
        One merchant per line, or comma-separated. Up to 20 at a time.
        {merchantCount > 0 && (
          <span style={{ color: "var(--text-secondary)" }}>
            {" "}
            {merchantCount} merchant{merchantCount !== 1 ? "s" : ""} detected.
          </span>
        )}
      </p>

      <button
        type="button"
        className="press"
        onClick={handleSuggest}
        disabled={!canSuggest}
        style={{
          padding: "10px 20px",
          background: "#f59e0b",
          color: "#000",
          border: "none",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 700,
          cursor: canSuggest ? "pointer" : "not-allowed",
          opacity: canSuggest ? 1 : 0.45,
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {isLoading ? (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Thinking…
          </>
        ) : (
          "Suggest categories"
        )}
      </button>

      {suggestions.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-secondary)",
                margin: 0,
              }}
            >
              Suggestions
            </p>
            <button
              type="button"
              className="press"
              onClick={handleAddAll}
              disabled={isAddingAll || addingMerchant !== null}
              style={{
                padding: "5px 12px",
                background: "#22c55e1a",
                color: "#22c55e",
                border: "1px solid #22c55e44",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: isAddingAll || addingMerchant !== null ? "not-allowed" : "pointer",
                opacity: isAddingAll || addingMerchant !== null ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {isAddingAll ? "Saving…" : "Add all"}
            </button>
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {suggestions.map((suggestion) => {
              const isAdding = addingMerchant === suggestion.merchant;
              return (
                <li
                  key={suggestion.merchant}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {suggestion.merchant}
                  </span>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)", flexShrink: 0 }}>
                    →
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#f59e0b",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {suggestion.category}
                  </span>
                  <button
                    type="button"
                    className="press"
                    onClick={() => handleAddRule(suggestion)}
                    disabled={isAdding || addingMerchant !== null || isAddingAll}
                    style={{
                      padding: "5px 12px",
                      background: isAdding ? "var(--surface-2)" : "#22c55e1a",
                      color: "#22c55e",
                      border: "1px solid #22c55e44",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor:
                        isAdding || addingMerchant !== null || isAddingAll
                          ? "not-allowed"
                          : "pointer",
                      opacity: isAdding || addingMerchant !== null || isAddingAll ? 0.5 : 1,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isAdding ? "Saving…" : "Add rule"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
