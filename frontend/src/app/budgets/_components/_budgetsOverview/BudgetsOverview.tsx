"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, Budget, MonthlySummary } from "@/lib/api";
import { BudgetsManager } from "@/components/BudgetsManager";
import { useHiddenBudgetIds } from "@/hooks/use-hidden-budget-ids";
import { useLoadFailureBoundary } from "@/hooks/useLoadFailureBoundary";

/** Full-page budgets overview: loads all budgets and this month's summary, then renders the manager. */
export function BudgetsOverview() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { hiddenBudgetIds, toggleBudgetVisibility } = useHiddenBudgetIds();
  const reportLoadFailure = useLoadFailureBoundary();

  /** Loads budgets and the monthly summary in parallel; the summary feeds the category picker. */
  const loadData = useCallback(async () => {
    try {
      const [nextBudgets, nextSummary] = await Promise.all([
        api.getBudgets(),
        api.getMonthlySummary(),
      ]);
      setBudgets(nextBudgets);
      setMonthlySummary(nextSummary);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Refreshes after an edit; the budgets already on screen stay, so a failure is just a toast. */
  const reloadData = useCallback(async () => {
    try {
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load budgets");
    }
  }, [loadData]);

  /** Loads on mount; a failure shows the error page rather than "no budgets yet". */
  useEffect(() => {
    loadData().catch(reportLoadFailure);
  }, [loadData, reportLoadFailure]);

  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            marginBottom: "4px",
          }}
        >
          Budgets
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          Set monthly limits by category and track this month&rsquo;s spending against them.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: "92px", borderRadius: "12px" }} />
          ))}
        </div>
      ) : (
        <BudgetsManager
          budgets={budgets}
          monthlySummary={monthlySummary}
          onChanged={reloadData}
          hiddenBudgetIds={hiddenBudgetIds}
          onToggleBudgetVisibility={toggleBudgetVisibility}
        />
      )}
    </>
  );
}
