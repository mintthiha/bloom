"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PiggyBank } from "lucide-react";
import { api, Budget, MonthlySummary } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { BudgetCard } from "@/components/BudgetCard";
import { SelectableBudgetRow } from "@/components/SelectableBudgetRow";
import { RolloverInfoDialog } from "@/components/RolloverInfoDialog";
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
  // Ids the user has hidden from the dashboard card. The dashboard passes this to filter its list;
  // the /budgets page passes it plus onToggleBudgetVisibility to render the selection checkboxes.
  hiddenBudgetIds?: Set<string>;
  onToggleBudgetVisibility?: (id: string) => void;
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
export function BudgetsManager({
  budgets,
  monthlySummary,
  onChanged,
  hiddenBudgetIds,
  onToggleBudgetVisibility,
}: Props) {
  const [budgetCategory, setBudgetCategory] = useState("Groceries");
  const [customBudgetCategory, setCustomBudgetCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);

  const knownBudgetCategories = buildKnownCategories(budgets, monthlySummary);
  const pendingDeleteBudget = budgets.find((budget) => budget.id === pendingDeleteId) ?? null;

  // Manage mode (the /budgets page) shows every budget with a "show on dashboard" checkbox.
  // Otherwise (the dashboard card) the hidden ids simply filter the list down to the chosen budgets.
  const isManageMode = Boolean(onToggleBudgetVisibility);
  const budgetsToRender =
    !isManageMode && hiddenBudgetIds
      ? budgets.filter((budget) => !hiddenBudgetIds.has(budget.id))
      : budgets;
  const hiddenBudgetCount = hiddenBudgetIds
    ? budgets.filter((budget) => hiddenBudgetIds.has(budget.id)).length
    : 0;

  // Left-side note above the list: a how-to on the /budgets page, or a link back to it from the
  // dashboard when some budgets are hidden. Null when there is nothing to say (so the row right-aligns).
  const listHint = isManageMode ? (
    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
      Checked budgets appear on your dashboard Budgets card.
    </p>
  ) : hiddenBudgetCount > 0 ? (
    <Link
      href="/budgets"
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: "var(--text-secondary)",
        textDecoration: "none",
      }}
    >
      {hiddenBudgetCount} hidden · manage on Budgets page →
    </Link>
  ) : null;

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
      toast.success("Budget created");
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
          <div
            style={{
              display: "flex",
              justifyContent: listHint ? "space-between" : "flex-end",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {listHint}
            <RolloverInfoDialog />
          </div>

          {!isManageMode && budgetsToRender.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              All budgets are hidden from this card. Choose which to show on the{" "}
              <Link href="/budgets" style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                Budgets page
              </Link>
              .
            </p>
          ) : (
            budgetsToRender.map((budget) => {
              const budgetCard = (
                <BudgetCard
                  budget={budget}
                  budgets={budgets}
                  deletingBudgetId={deletingBudgetId}
                  onRequestDelete={setPendingDeleteId}
                  onChanged={onChanged}
                />
              );

              if (!isManageMode) {
                return <div key={budget.id}>{budgetCard}</div>;
              }

              return (
                <SelectableBudgetRow
                  key={budget.id}
                  budget={budget}
                  shownOnDashboard={!(hiddenBudgetIds?.has(budget.id) ?? false)}
                  onToggle={() => onToggleBudgetVisibility?.(budget.id)}
                >
                  {budgetCard}
                </SelectableBudgetRow>
              );
            })
          )}
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
