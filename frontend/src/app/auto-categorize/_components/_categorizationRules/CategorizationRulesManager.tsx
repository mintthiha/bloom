"use client";
import { useEffect, useRef, useState } from "react";
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

/** Shared category dropdown options rendered inside a select element. */
function CategoryOptions() {
  return (
    <>
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
    </>
  );
}

/** Card for creating, editing, and deleting merchant → category auto-categorization rules. */
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

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMerchant, setEditMerchant] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPendingBulkDelete, setIsPendingBulkDelete] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

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
          setSelectedIds(new Set());
          setEditingId(null);
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

  /** Syncs the select-all checkbox's indeterminate visual state when selection changes. */
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < rules.length;
    }
  }, [selectedIds.size, rules.length]);

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

  /** Opens inline edit mode for the given rule, pre-filling the edit inputs. */
  function handleStartEdit(rule: AutoCategorizationRule) {
    setEditingId(rule.id);
    setEditMerchant(rule.merchant);
    setEditCategory(rule.category);
  }

  /** Discards in-progress edits without saving. */
  function handleCancelEdit() {
    setEditingId(null);
    setEditMerchant("");
    setEditCategory("");
  }

  /** Persists the edited merchant/category via PATCH and updates the local list. */
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const merchant = editMerchant.trim();
    const category = editCategory.trim();
    if (!merchant || !category) return;
    setIsSavingEdit(true);
    try {
      const updated = await api.updateCategorizationRule(editingId, merchant, category);
      setRules((prev) =>
        prev
          .map((r) => (r.id === editingId ? updated : r))
          .sort((a, b) => a.merchant.localeCompare(b.merchant))
      );
      setEditingId(null);
      setEditMerchant("");
      setEditCategory("");
      toast.success(`Rule updated: ${merchant} → ${category}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update rule");
    } finally {
      setIsSavingEdit(false);
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(pendingDeleteId);
        return next;
      });
      if (editingId === pendingDeleteId) setEditingId(null);
      toast.success(`Rule for "${rule.merchant}" deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete rule");
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  }

  /** Toggles a single rule's checked state in the selection set. */
  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /** Selects all rules when none or some are selected; clears all when all are selected. */
  function handleSelectAll() {
    if (selectedIds.size === rules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rules.map((r) => r.id)));
    }
  }

  /** Deletes all selected rules in parallel, removing only the ones that succeeded. */
  async function handleConfirmBulkDelete() {
    setIsBulkDeleting(true);
    const idsToDelete = [...selectedIds];
    try {
      const results = await Promise.allSettled(
        idsToDelete.map((id) => api.deleteCategorizationRule(id))
      );
      const deletedIds = new Set(idsToDelete.filter((_, i) => results[i].status === "fulfilled"));
      const failedCount = idsToDelete.length - deletedIds.size;
      setRules((prev) => {
        const updated = prev.filter((r) => !deletedIds.has(r.id));
        const maxPage = Math.max(1, Math.ceil(updated.length / RULES_PER_PAGE));
        setCurrentPage((p) => Math.min(p, maxPage));
        return updated;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
      if (editingId && deletedIds.has(editingId)) setEditingId(null);
      if (deletedIds.size > 0) {
        toast.success(`${deletedIds.size} rule${deletedIds.size !== 1 ? "s" : ""} deleted`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} rule${failedCount > 1 ? "s" : ""} couldn't be deleted`);
      }
    } finally {
      setIsBulkDeleting(false);
      setIsPendingBulkDelete(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(rules.length / RULES_PER_PAGE));
  const pageStart = (currentPage - 1) * RULES_PER_PAGE;
  const visibleRules = rules.slice(pageStart, pageStart + RULES_PER_PAGE);
  const pendingDeleteRule = rules.find((r) => r.id === pendingDeleteId) ?? null;
  const isFormValid = merchantInput.trim().length > 0 && categoryInput.trim().length > 0;
  const isEditFormValid = editMerchant.trim().length > 0 && editCategory.trim().length > 0;
  const allSelected = rules.length > 0 && selectedIds.size === rules.length;

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

      {/* Add rule form */}
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
          <CategoryOptions />
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
          {/* Bulk-actions bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              aria-label="Select all rules"
              style={{ width: "15px", height: "15px", cursor: "pointer", flexShrink: 0 }}
            />
            <span style={{ fontSize: "13px", color: "var(--text-muted)", flex: 1 }}>
              {selectedIds.size > 0
                ? `${selectedIds.size} of ${rules.length} selected`
                : `${rules.length} rule${rules.length !== 1 ? "s" : ""}`}
            </span>
            {selectedIds.size > 0 && (
              <button
                type="button"
                className="budget-delete-button"
                onClick={() => setIsPendingBulkDelete(true)}
                style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 600 }}
              >
                Delete {selectedIds.size} selected
              </button>
            )}
          </div>

          {/* Rules list */}
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
            {visibleRules.map((rule) =>
              editingId === rule.id ? (
                // Inline edit row
                <li
                  key={rule.id}
                  style={{
                    padding: "10px 14px",
                    background: "var(--surface-2)",
                    border: "1px solid #3b82f660",
                    borderRadius: "10px",
                  }}
                >
                  <form
                    onSubmit={handleSaveEdit}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "stretch",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="text"
                      value={editMerchant}
                      onChange={(e) => setEditMerchant(e.target.value)}
                      placeholder="Merchant name"
                      disabled={isSavingEdit}
                      autoFocus
                      style={{ ...inputStyle, flex: "1 1 140px", width: "auto" }}
                    />
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      disabled={isSavingEdit}
                      style={{
                        ...inputStyle,
                        flex: "1 1 120px",
                        width: "auto",
                        cursor: "pointer",
                        appearance: "none",
                        color: editCategory ? "var(--text-primary)" : "var(--text-muted)",
                      }}
                    >
                      <CategoryOptions />
                    </select>
                    <button
                      type="submit"
                      className="press"
                      disabled={!isEditFormValid || isSavingEdit}
                      style={{
                        padding: "8px 14px",
                        background: "#3b82f6",
                        color: "#000",
                        border: "none",
                        borderRadius: "7px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: !isEditFormValid || isSavingEdit ? "not-allowed" : "pointer",
                        opacity: !isEditFormValid || isSavingEdit ? 0.45 : 1,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {isSavingEdit ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="press"
                      onClick={handleCancelEdit}
                      disabled={isSavingEdit}
                      style={{
                        padding: "8px 14px",
                        background: "var(--surface-1)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: "7px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: isSavingEdit ? "not-allowed" : "pointer",
                        opacity: isSavingEdit ? 0.45 : 1,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                </li>
              ) : (
                // Display row
                <li
                  key={rule.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    background: selectedIds.has(rule.id) ? "#3b82f608" : "var(--surface-2)",
                    border: selectedIds.has(rule.id)
                      ? "1px solid #3b82f640"
                      : "1px solid var(--border)",
                    borderRadius: "10px",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(rule.id)}
                    onChange={() => handleToggleSelect(rule.id)}
                    aria-label={`Select rule for ${rule.merchant}`}
                    style={{ width: "15px", height: "15px", cursor: "pointer", flexShrink: 0 }}
                  />
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
                    className="rule-edit-button"
                    aria-label={`Edit rule for ${rule.merchant}`}
                    onClick={() => handleStartEdit(rule)}
                    style={{ padding: "4px 6px", flexShrink: 0, lineHeight: 1 }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
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
              )
            )}
          </ul>

          {/* Pagination */}
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

      {/* Single-rule delete dialog */}
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

      {/* Bulk delete dialog */}
      <ConfirmDeleteDialog
        open={isPendingBulkDelete}
        onOpenChange={(open) => {
          if (!open && !isBulkDeleting) setIsPendingBulkDelete(false);
        }}
        title={`Delete ${selectedIds.size} rule${selectedIds.size !== 1 ? "s" : ""}?`}
        description={`${selectedIds.size} rule${selectedIds.size !== 1 ? "s" : ""} will be permanently removed. Existing transactions are not affected.`}
        onConfirm={handleConfirmBulkDelete}
        isDeleting={isBulkDeleting}
        confirmLabel="Delete all"
      />
    </div>
  );
}
