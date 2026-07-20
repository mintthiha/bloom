"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, Budget } from "@/lib/api";

type Props = {
  budget: Budget;
  onChanged: () => Promise<void>;
};

/**
 * Small pill that flips a budget between rollover (carry-forward) and plain
 * monthly-cap mode, calling the API and confirming with a toast.
 */
export function BudgetRolloverToggle({ budget, onChanged }: Props) {
  const [saving, setSaving] = useState(false);

  /** Persists the flipped rollover state and refreshes the parent list. */
  async function handleToggle() {
    const next = !budget.rolloverEnabled;
    setSaving(true);
    try {
      await api.setBudgetRollover(budget.id, next);
      toast.success(next ? "Rollover enabled" : "Rollover disabled");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update rollover");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      aria-pressed={budget.rolloverEnabled}
      title={
        budget.rolloverEnabled
          ? "Unspent money rolls into next month"
          : "Enable to roll unspent money forward"
      }
      style={{
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 600,
        borderRadius: "999px",
        cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.5 : 1,
        border: `1px solid ${budget.rolloverEnabled ? "#3b82f6" : "var(--border)"}`,
        background: budget.rolloverEnabled ? "#3b82f61a" : "transparent",
        color: budget.rolloverEnabled ? "#3b82f6" : "var(--text-secondary)",
      }}
    >
      {budget.rolloverEnabled ? "Rollover on" : "Rollover off"}
    </button>
  );
}
