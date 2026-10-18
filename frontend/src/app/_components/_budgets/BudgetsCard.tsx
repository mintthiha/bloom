"use client";
import { Budget, MonthlySummary } from "@/lib/api";
import { AskBloomButton } from "@/components/AskBloomButton";
import { CollapsibleCard } from "@/components/collapsible-card";
import { BudgetsManager } from "@/components/BudgetsManager";
import { useHiddenBudgetIds } from "@/hooks/use-hidden-budget-ids";
import { buildBudgetsPrompt } from "./ask-about-budgets";

type Props = {
  budgets: Budget[];
  monthlySummary: MonthlySummary | null;
  onChanged: () => Promise<void>;
};

/** Dashboard budget card: a collapsible wrapper around the shared budget manager. */
export function BudgetsCard({ budgets, monthlySummary, onChanged }: Props) {
  // Dashboard reads the selection to filter its list; toggling happens on the /budgets page.
  const { hiddenBudgetIds } = useHiddenBudgetIds();
  // Ask Bloom about the budgets this card actually shows, not the ones hidden from the dashboard.
  const visibleBudgets = budgets.filter((budget) => !hiddenBudgetIds.has(budget.id));

  /** Header controls; the Ask Bloom pill only shows while expanded and when there's a budget to ask about. */
  function renderHeaderRight(isCollapsed: boolean) {
    return (
      <>
        {!isCollapsed && visibleBudgets.length > 0 && (
          <AskBloomButton topic="budgets" buildPrompt={() => buildBudgetsPrompt(visibleBudgets)} />
        )}
        <span className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {budgets.length} saved
        </span>
      </>
    );
  }

  return (
    <CollapsibleCard
      eyebrow="Budgets"
      title="Set monthly limits by category"
      description="Budgets compare this month's withdrawal totals against your category limits."
      headerRight={renderHeaderRight}
      className="fade-up fade-up-2"
      style={{}}
    >
      <BudgetsManager
        budgets={budgets}
        monthlySummary={monthlySummary}
        onChanged={onChanged}
        hiddenBudgetIds={hiddenBudgetIds}
      />
    </CollapsibleCard>
  );
}
