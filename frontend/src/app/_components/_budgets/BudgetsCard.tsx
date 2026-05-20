"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api, Budget, MonthlySummary } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { CollapsibleCard } from "@/components/collapsible-card";

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
function buildKnownCategories(
  budgets: Budget[],
  monthlySummary: MonthlySummary | null
): string[] {
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

/** Monthly budget card: add/delete budgets with live progress bars. */
export function BudgetsCard({ budgets, monthlySummary, onChanged }: Props) {
  const [budgetCategory, setBudgetCategory] = useState("Groceries");
  const [customBudgetCategory, setCustomBudgetCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  const knownBudgetCategories = buildKnownCategories(budgets, monthlySummary);

  /** Validates and saves a budget category limit via the API. */
  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    setBudgetError(null);
    const monthlyLimit = parseFloat(budgetAmount);
    const category =
      budgetCategory === "Custom..."
        ? customBudgetCategory.trim()
        : budgetCategory;

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
      setBudgetError(
        err instanceof Error ? err.message : "Failed to save budget"
      );
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
      setBudgetError(
        err instanceof Error ? err.message : "Failed to delete budget"
      );
    } finally {
      setDeletingBudgetId(null);
    }
  }

  const headerRight = (
    <span className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
      {budgets.length} saved
    </span>
  );

  return (
    <CollapsibleCard
      eyebrow="Budgets"
      title="Set monthly limits by category"
      description="Budgets compare this month's withdrawal totals against your category limits."
      headerRight={headerRight}
      className="fade-up fade-up-2"
      style={{}}
    >
      <form onSubmit={handleSaveBudget} style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 150px) auto",
            gap: "10px",
            alignItems: "stretch",
          }}
        >
          <select
            value={budgetCategory}
            onChange={(e) => setBudgetCategory(e.target.value)}
            aria-label="Budget category"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "var(--text-primary)",
              outline: "none",
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
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={budgetSaving}
            style={{
              padding: "10px 18px",
              background: "#f59e0b",
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
              outline: "none",
            }}
          />
        )}

        {budgetError && (
          <p
            className="num"
            style={{ color: "#f87171", fontSize: "12px", marginTop: "10px" }}
          >
            {budgetError}
          </p>
        )}
      </form>

      {budgets.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          No budgets yet. Add one above to start tracking category limits.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {budgets.map((budget) => {
            const progress = Math.min(budget.percentageUsed, 100);
            return (
              <div
                key={budget.id}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
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
                    onClick={() => handleDeleteBudget(budget.id)}
                    disabled={deletingBudgetId === budget.id}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      cursor:
                        deletingBudgetId === budget.id
                          ? "not-allowed"
                          : "pointer",
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
                        background: budget.isOverBudget ? "#ef4444" : "#f59e0b",
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
                        color: budget.isOverBudget
                          ? "#f87171"
                          : "var(--text-secondary)",
                      }}
                    >
                      {budget.isOverBudget
                        ? `${formatCurrency(Math.abs(budget.remaining))} over budget`
                        : `${formatCurrency(budget.remaining)} remaining`}
                    </span>
                    <span
                      className="num"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {budget.percentageUsed.toFixed(0)}% used
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleCard>
  );
}
