"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PiggyBank } from "lucide-react";
import { api, Budget, MonthlySummary } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EXPENSE_BUDGET_CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Dining",
  "Shopping",
  "Healthcare",
  "Entertainment",
  "Other",
];

type Props = {
  budgets: Budget[];
  monthlySummary: MonthlySummary | null;
  onChanged: () => Promise<void>;
};

/** Builds a sorted, deduplicated list of selectable budget categories. */
function buildKnownCategories(budgets: Budget[], monthlySummary: MonthlySummary | null): string[] {
  const expenseCategories =
    monthlySummary?.categories
      .filter((category) => category.spending > 0)
      .map((category) => category.category) ?? [];

  return Array.from(
    new Set([
      ...EXPENSE_BUDGET_CATEGORIES,
      ...expenseCategories,
      ...budgets.map((budget) => budget.category),
    ])
  ).sort((left, right) => left.localeCompare(right));
}

/**
 * Controlled budget management UI: add a category limit, list saved budgets with live
 * progress bars, and delete. Shared by the dashboard's BudgetsCard and the /budgets page;
 * the parent owns the data and passes budgets, monthlySummary, and an onChanged refresh.
 */
export function BudgetsManager({ budgets, monthlySummary, onChanged }: Props) {
  const [budgetCategory, setBudgetCategory] = useState("Groceries");
  const [customBudgetCategory, setCustomBudgetCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  const knownBudgetCategories = buildKnownCategories(budgets, monthlySummary);
  const pendingDeleteBudget = budgets.find((budget) => budget.id === pendingDeleteId) ?? null;

  /** Validates and saves a budget category limit via the API. */
  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    setBudgetError(null);
    const monthlyLimit = parseFloat(budgetAmount);
    const category = budgetCategory === "Custom..." ? customBudgetCategory.trim() : budgetCategory;

    if (!category) {
      setBudgetError("Choose a category");
      return;
    }
    if (Number.isNaN(monthlyLimit) || monthlyLimit <= 0) {
      setBudgetError("Enter a valid monthly limit");
      return;
    }

    setBudgetSaving(true);
    try {
      await api.saveBudget(category, monthlyLimit);
      setBudgetAmount("");
      setCustomBudgetCategory("");
      setBudgetCategory("Groceries");
      await onChanged();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : "Failed to save budget");
    } finally {
      setBudgetSaving(false);
    }
  }

  /** Deletes a budget by id and refreshes the list. */
  async function handleDeleteBudget(id: string) {
    setDeletingBudgetId(id);
    setBudgetError(null);
    try {
      await api.deleteBudget(id);
      toast.success("Budget deleted");
      await onChanged();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : "Failed to delete budget");
    } finally {
      setDeletingBudgetId(null);
      setPendingDeleteId(null);
    }
  }

  return (
    <>
      <form onSubmit={handleSaveBudget} style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "stretch",
          }}
        >
          <select
            value={budgetCategory}
            onChange={(e) => setBudgetCategory(e.target.value)}
            aria-label="Budget category"
            style={{
              flex: "1 1 180px",
              minWidth: 0,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          >
            {knownBudgetCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
            <option value="Custom...">Custom...</option>
          </select>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={budgetAmount}
            onChange={(e) => setBudgetAmount(e.target.value)}
            placeholder="Monthly limit"
            style={{
              flex: "0 1 150px",
              minWidth: 0,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          />
          <button
            type="submit"
            className="press"
            disabled={budgetSaving}
            style={{
              flex: "0 0 auto",
              padding: "10px 18px",
              background: "#3b82f6",
              color: "#000",
              fontWeight: 700,
              fontSize: "14px",
              border: "none",
              borderRadius: "8px",
              cursor: budgetSaving ? "not-allowed" : "pointer",
              opacity: budgetSaving ? 0.45 : 1,
            }}
          >
            {budgetSaving ? "Saving..." : "Save Budget"}
          </button>
        </div>

        {budgetCategory === "Custom..." && (
          <input
            type="text"
            value={customBudgetCategory}
            onChange={(e) => setCustomBudgetCategory(e.target.value)}
            placeholder="Custom category"
            style={{
              marginTop: "10px",
              width: "100%",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          />
        )}

        {budgetError && (
          <p className="num" style={{ color: "#f87171", fontSize: "12px", marginTop: "10px" }}>
            {budgetError}
          </p>
        )}
      </form>

      {budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          variant="inline"
          title="No budgets yet"
          description="Add one above to start tracking spending against category limits."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {budgets.map((budget) => {
            const progress = Math.min(budget.percentageUsed, 100);
            return (
              <div
                key={budget.id}
                className="budget-card"
                style={{
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <Link
                    href={`/budgets/${budget.id}`}
                    style={{ minWidth: 0, flex: 1, textDecoration: "none", color: "inherit" }}
                  >
                    <p style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
                      {budget.category}
                    </p>
                    <p className="num" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {formatCurrency(budget.currentSpending)} spent of{" "}
                      {formatCurrency(budget.monthlyLimit)}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(budget.id)}
                    disabled={deletingBudgetId === budget.id}
                    className="budget-delete-button"
                    style={{
                      padding: "8px 12px",
                      fontSize: "12px",
                      cursor: deletingBudgetId === budget.id ? "not-allowed" : "pointer",
                      opacity: deletingBudgetId === budget.id ? 0.45 : 1,
                    }}
                  >
                    {deletingBudgetId === budget.id ? "Deleting..." : "Delete"}
                  </button>
                </div>

                <Link
                  href={`/budgets/${budget.id}`}
                  style={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      height: "10px",
                      borderRadius: "999px",
                      background: "#ffffff0a",
                      overflow: "hidden",
                      marginBottom: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: budget.isOverBudget ? "#ef4444" : "#3b82f6",
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      fontSize: "12px",
                    }}
                  >
                    <span
                      className="num"
                      style={{
                        color: budget.isOverBudget ? "#f87171" : "var(--text-secondary)",
                      }}
                    >
                      {budget.isOverBudget
                        ? `${formatCurrency(Math.abs(budget.remaining))} over budget`
                        : `${formatCurrency(budget.remaining)} remaining`}
                    </span>
                    <span className="num" style={{ color: "var(--text-muted)" }}>
                      {budget.percentageUsed.toFixed(0)}% used
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingBudgetId) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <div style={{ padding: "12px 14px" }}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete budget?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDeleteBudget
                  ? `Your "${pendingDeleteBudget.category}" budget will be permanently removed.`
                  : "This budget will be permanently removed."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                onClick={() => setPendingDeleteId(null)}
                disabled={Boolean(deletingBudgetId)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={() => pendingDeleteId && handleDeleteBudget(pendingDeleteId)}
                disabled={Boolean(deletingBudgetId)}
              >
                {deletingBudgetId ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
