"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, TransactionSearchResult, AccountType } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { useIsMobile } from "@/hooks/use-mobile";

/** Dispatches the custom event that opens the command palette from anywhere in the app. */
export function openCommandPalette() {
  window.dispatchEvent(new Event("bloom:search"));
}

/** Formats an ISO date string as "Jan 15, 2026" for the search result list. */
function formatResultDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Returns the display label for a result's account (nickname if set, otherwise owner name). */
function resolveAccountLabel(result: TransactionSearchResult): string {
  return result.accountNickname ?? result.accountName;
}

/** Global command-palette modal for searching transactions across all accounts. */
export function CommandPalette() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TransactionSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Opens the palette and resets search state. */
  function handleOpen() {
    setIsOpen(true);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
  }

  /** Closes the palette. */
  function handleClose() {
    setIsOpen(false);
  }

  /** Navigates to the account page for the given result and closes the palette. */
  function navigateToResult(result: TransactionSearchResult) {
    router.push(`/account/${result.accountId}`);
    handleClose();
  }

  /** Registers Cmd+K / Ctrl+K and the bloom:search custom event to open the palette. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleOpen();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("bloom:search", handleOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("bloom:search", handleOpen);
    };
  }, []);

  /** Focuses the input whenever the palette opens. */
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  /** Scrolls the highlighted result into view when navigating with arrow keys. */
  useEffect(() => {
    const el = document.querySelector(`[data-result-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  /** Debounces search requests as the user types, resetting the selected index. */
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchTransactions(query.trim());
        setResults(data);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  /** Handles arrow-key navigation, Enter to navigate, and Escape to close. */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const result = results[selectedIndex];
      if (result) navigateToResult(result);
    } else if (e.key === "Escape") {
      handleClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: isMobile ? "10vh" : "18vh",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: "calc(100% - 32px)",
          maxWidth: "560px",
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          maxHeight: isMobile ? "80vh" : undefined,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search transactions…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "15px",
              color: "var(--text-primary)",
            }}
          />
          {loading && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Searching…</span>
          )}
          <kbd
            style={{
              fontSize: "10px",
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: "5px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        {query.trim() && (
          <div style={{ maxHeight: isMobile ? "min(280px, 50vh)" : "380px", overflowY: "auto" }}>
            {results.length === 0 && !loading ? (
              <div
                style={{
                  padding: "28px 18px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                }}
              >
                No transactions found for &ldquo;{query}&rdquo;
              </div>
            ) : (
              results.map((result, i) => {
                const isInflow = result.type === "DEPOSIT" || result.type === "TRANSFER_IN";
                const amountColor = isInflow ? "#22c55e" : "#f87171";
                const amountSign = isInflow ? "+" : "−";
                const typeMeta = ACCOUNT_TYPE_META[result.accountType as AccountType];
                const isSelected = i === selectedIndex;

                return (
                  <div
                    key={result.id}
                    data-result-index={i}
                    onClick={() => navigateToResult(result)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      padding: "11px 18px",
                      cursor: "pointer",
                      background: isSelected ? "var(--surface-2)" : "transparent",
                      borderBottom: "1px solid var(--border)",
                      transition: "background 0.1s",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {result.merchant ?? result.description ?? "Transaction"}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginTop: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "1px 5px",
                            borderRadius: "4px",
                            background: typeMeta.soft,
                            border: `1px solid ${typeMeta.border}`,
                            color: typeMeta.color,
                            letterSpacing: "0.04em",
                            flexShrink: 0,
                          }}
                        >
                          {typeMeta.label}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {resolveAccountLabel(result)}
                        </span>
                        {result.category && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            · {result.category}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p
                        className="num"
                        style={{ fontSize: "13px", fontWeight: 700, color: amountColor }}
                      >
                        {amountSign}
                        {formatCurrency(result.amount)}
                      </p>
                      <p
                        className="num"
                        style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}
                      >
                        {formatResultDate(result.effectiveAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer hint */}
        {!query.trim() && (
          <div
            style={{
              padding: "20px 18px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            Type to search across all accounts
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: "16px",
            justifyContent: "center",
            padding: "8px 18px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          {[
            ["↑↓", "navigate"],
            ["↵", "open account"],
            ["Esc", "close"],
          ].map(([key, label]) => (
            <span
              key={key}
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <kbd
                style={{
                  fontSize: "10px",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                }}
              >
                {key}
              </kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
