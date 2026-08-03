"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, AutoCategorizationRule } from "@/lib/api";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants/account";
import { inputStyle } from "@/lib/styles/input";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

const RULES_PER_PAGE = 10;

interface CategorizationRulesManagerProps {
  /** Incrementing this value triggers a re-fetch of the rules list from the API. */
  refreshTrigger?: number;
}

/** Card for creating and deleting merchant → category auto-categorization rules. */
export function CategorizationRulesManager({
  refreshTrigger = 0,
}: CategorizationRulesManagerProps) {
  const [rules, setRules] = useState<AutoCategorizationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [merchantInput, setMerchantInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  /** Loads the user's saved rules; re-runs when refreshTrigger changes. */
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    async function loadRules() {
      try {
        const data = await api.listCategorizationRules();
        if (!cancelled) {
          setRules(data);
          setCurrentPage(1);
        }
      } catch {
        // Silently fall back to empty list.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadRules();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  /** Saves a new rule (or updates the existing rule for that merchant) and resets the form. */
  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    const merchant = merchantInput.trim();
    const category = categoryInput.trim();
    if (!merchant || !category) return;
    setIsSaving(true);
    try {
      const saved = await api.upsertCategorizationRule(merchant, category);
      setRules((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === saved.id);
        if (existingIndex >= 0) {
          return prev.map((r, i) => (i === existingIndex ? saved : r));
        }
        return [...prev, saved].sort((a, b) => a.merchant.localeCompare(b.merchant));
      });
      setMerchantInput("");
      setCategoryInput("");
      toast.success(`Rule saved: ${merchant} → ${category}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save rule");
    } finally {
      setIsSaving(false);
    }
  }

  /** Deletes the rule identified by pendingDeleteId after the confirm dialog is accepted. */
  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    const rule = rules.find((r) => r.id === pendingDeleteId);
    if (!rule) return;
    setDeletingId(pendingDeleteId);
    try {
      await api.deleteCategorizationRule(pendingDeleteId);
      setRules((prev) => {
        const updated = prev.filter((r) => r.id !== pendingDeleteId);
        const maxPage = Math.max(1, Math.ceil(updated.length / RULES_PER_PAGE));
        setCurrentPage((p) => Math.min(p, maxPage));
        return updated;
      });
      toast.success(`Rule for "${rule.merchant}" deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete rule");
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(rules.length / RULES_PER_PAGE));
  const pageStart = (currentPage - 1) * RULES_PER_PAGE;
  const visibleRules = rules.slice(pageStart, pageStart + RULES_PER_PAGE);
  const pendingDeleteRule = rules.find((r) => r.id === pendingDeleteId) ?? null;
  const isFormValid = merchantInput.trim().length > 0 && categoryInput.trim().length > 0;

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "24px",
        opacity: isLoading ? 0.6 : 1,
      }}
    >
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>Your rules</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
        When a merchant matches a rule, Bloom automatically assigns the category during CSV import
        and manual entry.
      </p>

      <form
        onSubmit={handleAddRule}
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "stretch",
          flexWrap: "wrap",
          marginBottom: rules.length > 0 ? "20px" : "0",
        }}
      >
        <input
          type="text"
          value={merchantInput}
          onChange={(e) => setMerchantInput(e.target.value)}
          placeholder="Merchant name, e.g. Loblaws"
          disabled={isLoading || isSaving}
          style={{ ...inputStyle, flex: "1 1 180px", width: "auto" }}
        />
        <select
          value={categoryInput}
          onChange={(e) => setCategoryInput(e.target.value)}
          disabled={isLoading || isSaving}
          style={{
            ...inputStyle,
            flex: "1 1 140px",
            width: "auto",
            cursor: "pointer",
            appearance: "none",
            color: categoryInput ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          <option value="">Category</option>
          <optgroup label="Expenses">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
          <optgroup label="Income">
            {INCOME_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
        </select>
        <button
          type="submit"
          className="press"
          disabled={!isFormValid || isSaving || isLoading}
          style={{
            padding: "10px 20px",
            background: "#3b82f6",
            color: "#000",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: !isFormValid || isSaving || isLoading ? "not-allowed" : "pointer",
            opacity: !isFormValid || isSaving || isLoading ? 0.45 : 1,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {isSaving ? "Saving…" : "Add rule"}
        </button>
      </form>

      {rules.length > 0 && (
        <>
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
            {visibleRules.map((rule) => (
              <li
                key={rule.id}
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
                  {rule.merchant}
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-muted)", flexShrink: 0 }}>
                  →
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", flexShrink: 0 }}>
                  {rule.category}
                </span>
                <button
                  type="button"
                  className="budget-delete-button"
                  disabled={deletingId === rule.id}
                  aria-label={`Delete rule for ${rule.merchant}`}
                  onClick={() => setPendingDeleteId(rule.id)}
                  style={{
                    padding: "4px 6px",
                    flexShrink: 0,
                    lineHeight: 1,
                    cursor: deletingId === rule.id ? "not-allowed" : "pointer",
                    opacity: deletingId === rule.id ? 0.4 : 1,
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
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "16px",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {pageStart + 1}–{Math.min(pageStart + RULES_PER_PAGE, rules.length)} of{" "}
                {rules.length} rules
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className="press"
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
                <button
                  type="button"
                  className="press"
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
            </div>
          )}
        </>
      )}

      {!isLoading && rules.length === 0 && (
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
          No rules yet. Add one above or use AI suggestions.
        </p>
      )}

      <ConfirmDeleteDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) setPendingDeleteId(null);
        }}
        title="Delete rule?"
        description={
          <>
            The rule &ldquo;{pendingDeleteRule?.merchant} → {pendingDeleteRule?.category}&rdquo;
            will be removed. Existing transactions are not affected.
          </>
        }
        onConfirm={handleConfirmDelete}
        isDeleting={Boolean(deletingId)}
      />
    </div>
  );
}
