"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, AutoCategorizationRule, ImportCsvResult } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAiSuggestionsEnabled, setAiSuggestionsEnabled } from "@/lib/import-preferences";

import { CsvRow, CSV_TEMPLATE, parseCsvText, applyCategorizationRules } from "./import-csv";
import {
  countTransactions,
  describeImportResult,
  markDuplicateRows,
  selectRowsToImport,
  selectValidRows,
  summarizeImportRows,
  toImportPayloadRow,
} from "./import-duplicates";
import { RecentImports } from "./RecentImports";

const PAGE_SIZE = 10;

const CATEGORY_SUGGESTIONS = [
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Dining",
  "Shopping",
  "Healthcare",
  "Entertainment",
  "Other",
  "Salary",
  "Freelance",
  "Gift",
  "Investment",
  "Other Income",
];

type EditingCell = { index: number; field: "category" | "merchant" };

type ImportTabProps = {
  accountId: string;
  onSuccess: (result: ImportCsvResult) => void;
  onError: (message: string) => void;
  /** Called after a past import is undone, so the account page can reload its balance and history. */
  onImportUndone: () => void;
  categorizationRules: AutoCategorizationRule[];
};

/** CSV import panel: parse and preview a file, flag rows already on the account, then import the rest. */
export function ImportTab({
  accountId,
  onSuccess,
  onError,
  onImportUndone,
  categorizationRules,
}: ImportTabProps) {
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(() => getAiSuggestionsEnabled());
  const [isAiEnriching, setIsAiEnriching] = useState(false);
  const [aiEnrichError, setAiEnrichError] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [hasDuplicateCheckFailed, setHasDuplicateCheckFailed] = useState(false);
  const [recentImportsRefreshKey, setRecentImportsRefreshKey] = useState(0);
  /** Increments per chosen file so a slow duplicate check can't mark rows from a newer file. */
  const fileGenerationRef = useRef(0);

  /** Toggles AI enrichment, persists the preference, and cancels any in-progress stream when disabled. */
  function handleAiToggle(enabled: boolean) {
    setAiEnabled(enabled);
    setAiSuggestionsEnabled(enabled);
    if (!enabled && isAiEnriching) {
      aiAbortRef.current?.abort();
    }
  }

  /**
   * Streams AI suggestions from the backend SSE endpoint, updating each row in place
   * as the model emits a merchant's category rather than waiting for the full response.
   */
  async function enrichRowsWithAi(rows: CsvRow[], signal: AbortSignal): Promise<void> {
    const uncategorizedMerchants = [
      ...new Set(
        rows.filter((r) => !r.error && r.merchant && !r.category).map((r) => r.merchant as string)
      ),
    ].slice(0, 20);
    if (uncategorizedMerchants.length === 0) return;

    const response = await fetch("/api/bloom/auto-categorize/suggest-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchants: uncategorizedMerchants }),
      signal,
    });

    if (!response.ok || !response.body) throw new Error("AI service unavailable");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event: error")) throw new Error("AI service unavailable");
        if (line.startsWith("event: done")) return;
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "{}") continue;
        try {
          const suggestion = JSON.parse(data) as { merchant: string; category: string };
          setCsvRows((prev) =>
            prev.map((row) => {
              if (row.merchant === suggestion.merchant && !row.category) {
                return { ...row, category: suggestion.category, aiSuggestedCategory: true };
              }
              return row;
            })
          );
        } catch {
          // malformed SSE data — skip
        }
      }
    }
  }

  /**
   * Asks the backend which parsed rows are already on the account and flags them so they are
   * skipped by default. A failed check is non-fatal: the server re-checks on import anyway.
   */
  async function checkForDuplicates(rows: CsvRow[], fileGeneration: number): Promise<void> {
    const validRows = selectValidRows(rows);
    if (validRows.length === 0) return;
    setIsCheckingDuplicates(true);
    try {
      const { duplicateRowIndexes } = await api.findImportDuplicates(
        accountId,
        validRows.map(toImportPayloadRow)
      );
      if (fileGenerationRef.current !== fileGeneration) return;
      setCsvRows((previousRows) => markDuplicateRows(previousRows, duplicateRowIndexes));
    } catch {
      if (fileGenerationRef.current === fileGeneration) setHasDuplicateCheckFailed(true);
    } finally {
      if (fileGenerationRef.current === fileGeneration) setIsCheckingDuplicates(false);
    }
  }

  /** Flips whether a flagged duplicate is imported anyway (for a genuine repeat purchase) or skipped. */
  function toggleImportAnyway(index: number) {
    setCsvRows((previousRows) =>
      previousRows.map((row, i) =>
        i === index ? { ...row, shouldImportAnyway: !row.shouldImportAnyway } : row
      )
    );
  }

  /** Parses the selected file into rows, applies local rules, flags duplicates, then enriches with AI for missing categories. */
  function handleCsvFile(file: File | null) {
    setCsvRows([]);
    setCsvParseError(null);
    setAiEnrichError(false);
    setCurrentPage(1);
    setEditingCell(null);
    setHasDuplicateCheckFailed(false);
    setIsCheckingDuplicates(false);
    fileGenerationRef.current += 1;
    const fileGeneration = fileGenerationRef.current;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseCsvText(text);
        if (parsed.length === 0) {
          setCsvParseError("No data rows found in file.");
          return;
        }
        const ruleMap: Record<string, string> = {};
        for (const rule of categorizationRules) {
          ruleMap[rule.merchant.toLowerCase()] = rule.category;
        }
        const withRules = applyCategorizationRules(parsed, ruleMap);
        setCsvRows(withRules);
        void checkForDuplicates(withRules, fileGeneration);
        if (!aiEnabled) return;
        const abortController = new AbortController();
        aiAbortRef.current = abortController;
        setIsAiEnriching(true);
        try {
          await enrichRowsWithAi(withRules, abortController.signal);
        } catch (err) {
          if (err instanceof Error && err.name !== "AbortError") {
            setAiEnrichError(true);
          }
        } finally {
          setIsAiEnriching(false);
          aiAbortRef.current = null;
        }
      } catch {
        setCsvParseError("Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
  }

  /** Imports the valid rows (minus skipped duplicates), then clears the preview so the file can't be imported twice. */
  async function handleImportCsv() {
    const rowsToImport = selectRowsToImport(csvRows);
    if (rowsToImport.length === 0) return;
    setCsvImporting(true);
    try {
      const result = await api.importCsv(accountId, rowsToImport.map(toImportPayloadRow));
      setCsvRows([]);
      setCurrentPage(1);
      setRecentImportsRefreshKey((key) => key + 1);
      const { tone, message } = describeImportResult(result);
      if (tone === "success") toast.success(message);
      else toast.info(message);
      onSuccess(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setCsvImporting(false);
    }
  }

  /** Opens an inline editor for a category or merchant cell. */
  function startEdit(index: number, field: "category" | "merchant", currentValue: string) {
    setEditingCell({ index, field });
    setEditValue(currentValue);
  }

  /** Saves the edited value back into the row and clears any AI-suggestion marker on the field. */
  function commitEdit() {
    if (!editingCell) return;
    setCsvRows((prev) =>
      prev.map((row, i) =>
        i === editingCell.index
          ? {
              ...row,
              [editingCell.field]: editValue.trim() || undefined,
              ...(editingCell.field === "category" ? { aiSuggestedCategory: false } : {}),
            }
          : row
      )
    );
    setEditingCell(null);
  }

  /** Discards the in-progress edit without modifying the row. */
  function cancelEdit() {
    setEditingCell(null);
  }

  const { errorCount, duplicateCount, importableCount } = summarizeImportRows(csvRows);
  const isImportBlocked = csvImporting || isAiEnriching || isCheckingDuplicates;
  const totalPages = Math.max(1, Math.ceil(csvRows.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = csvRows.slice(pageStart, pageStart + PAGE_SIZE);

  const editableInputStyle: React.CSSProperties = {
    background: "var(--surface-2)",
    border: "1px solid var(--brand-accent)",
    borderRadius: "5px",
    padding: "2px 6px",
    fontSize: "12px",
    color: "var(--text-primary)",
    width: "120px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <datalist id="import-category-options">
        {CATEGORY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Upload a CSV with columns:{" "}
        <span className="num" style={{ color: "var(--text-primary)" }}>
          date, type, amount, description, merchant, category
        </span>
        . Type accepts <span className="num">deposit</span>, <span className="num">withdrawal</span>
        , <span className="num">charge</span>, <span className="num">payment</span>,{" "}
        <span className="num">credit</span>, or <span className="num">debit</span>.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Switch id="ai-categorize-toggle" checked={aiEnabled} onCheckedChange={handleAiToggle} />
        <label
          htmlFor="ai-categorize-toggle"
          style={{ fontSize: "13px", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          AI category suggestions
        </label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              style={{
                color: "var(--text-muted)",
                cursor: "help",
                fontSize: "13px",
                lineHeight: 1,
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              ⓘ
            </TooltipTrigger>
            <TooltipContent side="right" style={{ maxWidth: "220px", padding: "10px 14px" }}>
              AI will suggest categories for unrecognized merchants. Turning this off while
              suggestions are loading will also cancel the generation.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 16px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Choose file
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              handleCsvFile(e.target.files?.[0] ?? null);
              // Clear the input so choosing the same file again still triggers a fresh parse.
              e.target.value = "";
            }}
          />
        </label>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`}
          download="bloom-import-template.csv"
          style={{
            fontSize: "12px",
            color: "var(--brand-accent-text)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Download template
        </a>
      </div>

      {csvParseError && (
        <p style={{ fontSize: "12px", color: "var(--negative-soft)" }}>{csvParseError}</p>
      )}

      {csvRows.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {csvRows.length} row{csvRows.length !== 1 ? "s" : ""} parsed
              {errorCount > 0 && (
                <span style={{ color: "var(--negative-soft)" }}>{errorCount} with errors</span>
              )}
              {isCheckingDuplicates && (
                <span style={{ color: "var(--text-muted)" }}>Checking for duplicates…</span>
              )}
              {!isCheckingDuplicates && duplicateCount > 0 && (
                <span style={{ color: "var(--brand-accent-text)", fontWeight: 600 }}>
                  {duplicateCount} already imported
                </span>
              )}
              {!isCheckingDuplicates && hasDuplicateCheckFailed && (
                <span style={{ color: "var(--text-muted)" }}>
                  Couldn&apos;t check for duplicates — exact repeats are still skipped on import
                </span>
              )}
              {isAiEnriching && (
                <span style={{ color: "#8b5cf6", fontWeight: 600 }}>✦ AI suggesting…</span>
              )}
              {!isAiEnriching && aiEnrichError && (
                <span style={{ color: "var(--negative-soft)" }}>AI suggestions unavailable</span>
              )}
            </span>
            {importableCount > 0 && (
              <span
                title={
                  isAiEnriching
                    ? "AI suggested categories are still loading"
                    : isCheckingDuplicates
                      ? "Still checking for duplicates"
                      : undefined
                }
              >
                <button
                  className="press"
                  onClick={handleImportCsv}
                  disabled={isImportBlocked}
                  style={{
                    padding: "8px 16px",
                    background: "var(--brand-accent)",
                    color: "#000",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: isImportBlocked ? "not-allowed" : "pointer",
                    opacity: isImportBlocked ? 0.5 : 1,
                  }}
                >
                  {csvImporting ? "Importing..." : `Import ${countTransactions(importableCount)}`}
                </button>
              </span>
            )}
            {importableCount === 0 && duplicateCount > 0 && !isCheckingDuplicates && (
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Everything in this file is already imported
              </span>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr>
                  {["Date", "Type", "Amount", "Category", "Merchant", "Description", ""].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "6px 8px",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          fontSize: "10px",
                          whiteSpace: "nowrap",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, i) => {
                  const absoluteIndex = pageStart + i;
                  const isEditingCategory =
                    editingCell?.index === absoluteIndex && editingCell.field === "category";
                  const isEditingMerchant =
                    editingCell?.index === absoluteIndex && editingCell.field === "merchant";
                  const isSkippedDuplicate = row.isDuplicate === true && !row.shouldImportAnyway;

                  return (
                    <tr
                      key={absoluteIndex}
                      style={{
                        background: row.error ? "#f8717108" : "transparent",
                        opacity: isSkippedDuplicate ? 0.55 : 1,
                      }}
                    >
                      <td
                        className="num"
                        style={{
                          padding: "7px 8px",
                          color: row.error ? "var(--negative-soft)" : "var(--text-primary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.date}
                      </td>
                      <td
                        style={{
                          padding: "7px 8px",
                          color: row.error ? "var(--negative-soft)" : "var(--text-primary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.type}
                      </td>
                      <td
                        className="num"
                        style={{
                          padding: "7px 8px",
                          color: row.error ? "var(--negative-soft)" : "var(--text-primary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.amount}
                      </td>

                      <td
                        style={{
                          padding: "7px 8px",
                          whiteSpace: "nowrap",
                          cursor: isEditingCategory ? "default" : "pointer",
                        }}
                        onClick={() =>
                          !isEditingCategory &&
                          startEdit(absoluteIndex, "category", row.category ?? "")
                        }
                        title={isEditingCategory ? undefined : "Click to edit"}
                      >
                        {isEditingCategory ? (
                          <input
                            autoFocus
                            value={editValue}
                            list="import-category-options"
                            aria-label="Edit category"
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              else if (e.key === "Escape") cancelEdit();
                            }}
                            style={editableInputStyle}
                          />
                        ) : (
                          <span
                            style={{
                              color: row.category ? "var(--text-secondary)" : "var(--text-muted)",
                              borderBottom: "1px dashed var(--border)",
                              paddingBottom: "1px",
                              ...(row.aiSuggestedCategory
                                ? {
                                    background: "rgba(139, 92, 246, 0.1)",
                                    borderRadius: "3px",
                                    padding: "1px 5px",
                                    borderBottom: "none",
                                  }
                                : {}),
                            }}
                          >
                            {row.aiSuggestedCategory && (
                              <span
                                style={{ color: "#8b5cf6", marginRight: "3px", fontSize: "10px" }}
                              >
                                ✦
                              </span>
                            )}
                            {row.category ?? "—"}
                          </span>
                        )}
                      </td>

                      <td
                        style={{
                          padding: "7px 8px",
                          whiteSpace: "nowrap",
                          cursor: isEditingMerchant ? "default" : "pointer",
                        }}
                        onClick={() =>
                          !isEditingMerchant &&
                          startEdit(absoluteIndex, "merchant", row.merchant ?? "")
                        }
                        title={isEditingMerchant ? undefined : "Click to edit"}
                      >
                        {isEditingMerchant ? (
                          <input
                            autoFocus
                            value={editValue}
                            aria-label="Edit merchant"
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              else if (e.key === "Escape") cancelEdit();
                            }}
                            style={editableInputStyle}
                          />
                        ) : (
                          <span
                            style={{
                              color: row.merchant ? "var(--text-secondary)" : "var(--text-muted)",
                              borderBottom: "1px dashed var(--border)",
                              paddingBottom: "1px",
                            }}
                          >
                            {row.merchant ?? "—"}
                          </span>
                        )}
                      </td>

                      <td
                        style={{
                          padding: "7px 8px",
                          color: "var(--text-secondary)",
                          maxWidth: "180px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.description ?? "—"}
                      </td>
                      <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                        {row.error ? (
                          <span style={{ color: "var(--negative-soft)", fontSize: "11px" }}>
                            {row.error}
                          </span>
                        ) : row.isDuplicate ? (
                          <span
                            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                          >
                            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                              {row.shouldImportAnyway ? "Importing anyway" : "Already imported"}
                            </span>
                            <button
                              type="button"
                              className="import-duplicate-toggle"
                              onClick={() => toggleImportAnyway(absoluteIndex)}
                              aria-label={
                                row.shouldImportAnyway
                                  ? `Skip duplicate row ${absoluteIndex + 1}`
                                  : `Import duplicate row ${absoluteIndex + 1} anyway`
                              }
                            >
                              {row.shouldImportAnyway ? "Skip" : "Import anyway"}
                            </button>
                          </span>
                        ) : (
                          <span style={{ color: "var(--positive)", fontSize: "11px" }}>✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "12px",
                marginTop: "12px",
              }}
            >
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "5px 12px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  opacity: currentPage === 1 ? 0.4 : 1,
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: "5px 12px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "7px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  opacity: currentPage === totalPages ? 0.4 : 1,
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      <RecentImports
        accountId={accountId}
        refreshKey={recentImportsRefreshKey}
        onImportUndone={onImportUndone}
      />
    </div>
  );
}
