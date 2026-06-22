import { Account, Budget, MonthlySummary, RecurringTransaction } from "@/lib/api";

export type InsightSeverity = "warning" | "info" | "success";

export type InsightItem = {
  id: string;
  severity: InsightSeverity;
  message: string;
  detail: string;
};

type InsightsInput = {
  accounts: Account[];
  budgets: Budget[];
  monthlySummary: MonthlySummary;
  previousMonthlySummary: MonthlySummary | null;
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

/** Returns up to 3 prioritized financial action items derived from the current dashboard data. */
export function generateInsights({
  accounts,
  budgets,
  monthlySummary,
  previousMonthlySummary,
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

  if (insights.length >= MAX_INSIGHTS) return insights;

  // Rule 3: Emergency fund coverage (warning if < 1 month, info if 1–3 months)
  const liquidBalance = accounts
    .filter((a) => a.accountType === "CHEQUING" || a.accountType === "SAVINGS")
    .reduce((sum, a) => sum + a.balance, 0);
  const referenceSpending =
    (previousMonthlySummary?.spending ?? 0) > 0
      ? previousMonthlySummary!.spending
      : monthlySummary.spending;
  if (referenceSpending > 0) {
    const monthsCovered = liquidBalance / referenceSpending;
    if (monthsCovered < 1) {
      insights.push({
        id: "emergency-fund",
        severity: "warning",
        message: "Emergency fund covers less than 1 month of expenses",
        detail: `You have ${formatCurrencyWhole(liquidBalance)} in liquid savings. Target 3–6 months (${formatCurrencyWhole(referenceSpending * 3)}–${formatCurrencyWhole(referenceSpending * 6)}).`,
      });
    } else if (monthsCovered < 3) {
      insights.push({
        id: "emergency-fund",
        severity: "info",
        message: `Emergency fund covers ~${monthsCovered.toFixed(1)} months of expenses`,
        detail: `Good progress. Most advisors recommend 3–6 months. Target: ${formatCurrencyWhole(referenceSpending * 3)}.`,
      });
    }
  }

  if (insights.length >= MAX_INSIGHTS) return insights;

  // Rule 4: Idle chequing cash with registered accounts available (info)
  const totalChequing = accounts
    .filter((a) => a.accountType === "CHEQUING")
    .reduce((sum, a) => sum + a.balance, 0);
  const hasRegisteredAccounts = accounts.some(
    (a) => a.accountType === "TFSA" || a.accountType === "RRSP" || a.accountType === "FHSA"
  );
  if (totalChequing > 1000 && hasRegisteredAccounts) {
    insights.push({
      id: "idle-chequing",
      severity: "info",
      message: `${formatCurrencyWhole(totalChequing)} sitting in chequing`,
      detail: "Consider moving some to your TFSA, RRSP, or FHSA to grow it tax-free.",
    });
  }

  if (insights.length >= MAX_INSIGHTS) return insights;

  // Rule 5: Low savings rate — shown only when income exists (warning)
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

  // Rule 6: No budgets set but spending exists (info)
  if (budgets.length === 0 && monthlySummary.spending > 0) {
    insights.push({
      id: "no-budgets",
      severity: "info",
      message: "No budgets set yet",
      detail: `You've spent ${formatCurrencyWhole(monthlySummary.spending)} this month. Setting budgets helps you stay on track.`,
    });
  }

  if (insights.length >= MAX_INSIGHTS) return insights;

  // Rule 7: Good savings rate ≥ 20% — shown only when no warnings are present (success)
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
