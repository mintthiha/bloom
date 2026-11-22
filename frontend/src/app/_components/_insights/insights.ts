import { Budget, MonthlySummary, RecurringTransaction } from "@/lib/api";

export type InsightSeverity = "warning" | "info" | "success";

export type InsightItem = {
  id: string;
  severity: InsightSeverity;
  message: string;
  detail: string;
};

type InsightsInput = {
  budgets: Budget[];
  monthlySummary: MonthlySummary;
  recurringRules: RecurringTransaction[];
};

const MAX_INSIGHTS = 3;

/** Formats a whole-dollar CAD amount without cents for compact insight text. */
function formatCurrencyWhole(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Returns up to 3 prioritized "this month" action items: budgets, overdue bills, savings rate. */
export function generateInsights({
  budgets,
  monthlySummary,
  recurringRules,
}: InsightsInput): InsightItem[] {
  const insights: InsightItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeftInMonth =
    new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();

  // Rule 1: Over-budget categories (warning — highest priority)
  const overBudgetItems = budgets.filter((b) => b.isOverBudget);
  if (overBudgetItems.length > 0) {
    const worst = overBudgetItems.reduce((a, b) =>
      a.currentSpending - a.monthlyLimit > b.currentSpending - b.monthlyLimit ? a : b
    );
    const overage = worst.currentSpending - worst.monthlyLimit;
    insights.push({
      id: "over-budget",
      severity: "warning",
      message: `Over budget on ${worst.category} by ${formatCurrencyWhole(overage)}`,
      detail: `${daysLeftInMonth} day${daysLeftInMonth !== 1 ? "s" : ""} left this month${
        overBudgetItems.length > 1
          ? ` · ${overBudgetItems.length - 1} other categor${overBudgetItems.length === 2 ? "y" : "ies"} also over`
          : ""
      }.`,
    });
  }

  // Rule 2: Overdue recurring transactions (warning)
  const overdueRules = recurringRules.filter((rule) => {
    if (!rule.active) return false;
    const nextRunDate = new Date(rule.nextRunAt.slice(0, 10) + "T00:00:00");
    return nextRunDate < today;
  });
  if (overdueRules.length > 0 && insights.length < MAX_INSIGHTS) {
    insights.push({
      id: "overdue-recurring",
      severity: "warning",
      message: `${overdueRules.length} recurring transaction${overdueRules.length !== 1 ? "s" : ""} overdue`,
      detail: "Apply due transactions from the Recurring section to keep your balances accurate.",
    });
  }

  // Where savings should go (emergency fund, idle cash → TFSA, …) is the money ladder's job
  // (money-ladder.ts); these rules cover only this month's housekeeping.

  if (insights.length >= MAX_INSIGHTS) return insights;

  // Rule 3: Low savings rate — shown only when income exists (warning)
  if (monthlySummary.income > 0) {
    const savingsRate = monthlySummary.netCashFlow / monthlySummary.income;
    if (savingsRate < 0.1) {
      insights.push({
        id: "low-savings-rate",
        severity: "warning",
        message: `Savings rate is only ${Math.round(savingsRate * 100)}% this month`,
        detail: "Most financial plans target 20%. Review your largest spending categories.",
      });
    }
  }

  if (insights.length >= MAX_INSIGHTS) return insights;

  // Rule 4: No budgets set but spending exists (info)
  if (budgets.length === 0 && monthlySummary.spending > 0) {
    insights.push({
      id: "no-budgets",
      severity: "info",
      message: "No budgets set yet",
      detail: `You've spent ${formatCurrencyWhole(monthlySummary.spending)} this month. Setting budgets helps you stay on track.`,
    });
  }

  if (insights.length >= MAX_INSIGHTS) return insights;

  // Rule 5: Good savings rate ≥ 20% — shown only when no warnings are present (success)
  const hasWarnings = insights.some((i) => i.severity === "warning");
  if (!hasWarnings && monthlySummary.income > 0) {
    const savingsRate = monthlySummary.netCashFlow / monthlySummary.income;
    if (savingsRate >= 0.2) {
      insights.push({
        id: "good-savings-rate",
        severity: "success",
        message: `Savings rate is ${Math.round(savingsRate * 100)}% this month — great work`,
        detail: "You're above the 20% benchmark. Keep it up.",
      });
    }
  }

  return insights;
}
