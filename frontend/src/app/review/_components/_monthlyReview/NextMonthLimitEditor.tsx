"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Input } from "@/components/ui/input";

type NextMonthLimitEditorProps = {
  budgetId: string;
  category: string;
  nextMonth: string;
  nextMonthName: string;
  nextMonthLimit: number;
  onSaved: () => Promise<void>;
};

/**
 * Shows an envelope's limit for next month and lets the user change it for that month only —
 * past months (including the one being reviewed) keep the limit they had.
 */
export function NextMonthLimitEditor({
  budgetId,
  category,
  nextMonth,
  nextMonthName,
  nextMonthLimit,
  onSaved,
}: NextMonthLimitEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftLimit, setDraftLimit] = useState(String(nextMonthLimit));
  const [isSaving, setIsSaving] = useState(false);

  /** Opens the editor pre-filled with the current next-month limit. */
  function handleStartEditing() {
    setDraftLimit(String(nextMonthLimit));
    setIsEditing(true);
  }

  /** Saves the new limit for next month only, then refreshes the review. */
  async function handleSave() {
    const limit = Number(draftLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      toast.error("Enter a limit greater than zero");
      return;
    }
    setIsSaving(true);
    try {
      await api.setBudgetMonthLimit(budgetId, nextMonth, limit);
      toast.success(`${category} set to ${formatCurrency(limit)} for ${nextMonthName}`);
      setIsEditing(false);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the budget");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        className="budget-action-pill"
        onClick={handleStartEditing}
        aria-label={`Change ${category} limit for ${nextMonthName}`}
        style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
      >
        {nextMonthName}: <span className="num">{formatCurrency(nextMonthLimit)}</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
      style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}
    >
      <label
        htmlFor={`next-limit-${budgetId}`}
        style={{ fontSize: "12px", color: "var(--text-secondary)" }}
      >
        {nextMonthName} limit
      </label>
      <Input
        id={`next-limit-${budgetId}`}
        type="number"
        inputMode="decimal"
        step="0.01"
        autoFocus
        value={draftLimit}
        onChange={(event) => setDraftLimit(event.target.value)}
        style={{ width: "110px" }}
      />
      <button
        type="submit"
        className="press"
        disabled={isSaving}
        style={{
          padding: "6px 12px",
          background: "var(--brand-accent)",
          color: "#000",
          border: "none",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: isSaving ? "not-allowed" : "pointer",
          opacity: isSaving ? 0.5 : 1,
        }}
      >
        {isSaving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="quiet-text-button"
        onClick={() => setIsEditing(false)}
        disabled={isSaving}
        style={{
          fontSize: "12px",
          fontWeight: 600,
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </form>
  );
}
