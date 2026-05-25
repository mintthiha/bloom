import { Account, Budget, MonthlySummary, NetWorthSnapshot } from "./api";
import { formatCurrency } from "./format";

export interface SubScore {
  id: string;
  label: string;
  score: number;
  status: string;
  tip: string | null;
}

export type ScoreGrade = "A" | "B" | "C" | "D" | "F";

export interface HealthScore {
  total: number;
  grade: ScoreGrade;
  label: string;
  subScores: SubScore[];
}

export interface HealthScoreInputs {
  accounts: Account[];
  budgets: Budget[];
  monthlySummary: MonthlySummary;
  netWorthHistory: NetWorthSnapshot[];
}

/** Rates the percentage of income saved this period (0–20 pts). */
function scoreSavingsRate(income: number, netCashFlow: number): SubScore {
  if (income <= 0) {
    return {
      id: "savings_rate",
      label: "Savings Rate",
      score: 10,
      status: "No income recorded this period — score is neutral.",
      tip: "Record income transactions to track your savings rate.",
    };
  }
  const rate = netCashFlow / income;
  const pct = `${(rate * 100).toFixed(0)}%`;
  if (rate >= 0.2) {
    return { id: "savings_rate", label: "Savings Rate", score: 20, status: `Saving ${pct} of income — excellent. Most financial plans suggest 20% as a minimum.`, tip: null };
  }
  if (rate >= 0.15) {
    return { id: "savings_rate", label: "Savings Rate", score: 16, status: `Saving ${pct} of income — nearly there. Target is 20%+.`, tip: "Saving a few more percent would reach the recommended minimum." };
  }
  if (rate >= 0.1) {
    return { id: "savings_rate", label: "Savings Rate", score: 12, status: `Saving ${pct} of income — below the 20% target.`, tip: "Try reducing one discretionary expense to push your savings rate higher." };
  }
  if (rate >= 0.05) {
    return { id: "savings_rate", label: "Savings Rate", score: 6, status: `Saving only ${pct} of income — below the recommended 20%.`, tip: "Review your largest spending categories to find areas to cut back." };
  }
  if (rate >= 0) {
    return { id: "savings_rate", label: "Savings Rate", score: 2, status: "Saving less than 5% of income this period.", tip: "Even saving 1–2% more each month compounds significantly over time." };
  }
  return { id: "savings_rate", label: "Savings Rate", score: 0, status: "Spending exceeds income this period — negative savings rate.", tip: "Review recurring expenses and identify spending that can be reduced." };
}

/** Rates how many monthly budgets stay within their limits (0–20 pts). */
function scoreBudgetAdherence(budgets: Budget[]): SubScore {
  if (budgets.length === 0) {
    return {
      id: "budget_adherence",
      label: "Budget Adherence",
      score: 8,
      status: "No budgets set. Adding budgets is the first step to tracking spending.",
      tip: "Create at least one budget category to start tracking.",
    };
  }
  const overCount = budgets.filter((b) => b.isOverBudget).length;
  const within = budgets.length - overCount;
  const adherenceRate = within / budgets.length;

  if (overCount === 0) {
    return { id: "budget_adherence", label: "Budget Adherence", score: 20, status: `All ${budgets.length} budget${budgets.length !== 1 ? "s" : ""} within limit — great discipline.`, tip: null };
  }
  if (adherenceRate >= 0.75) {
    return { id: "budget_adherence", label: "Budget Adherence", score: 15, status: `${within} of ${budgets.length} budgets within limit. ${overCount} ${overCount === 1 ? "is" : "are"} over.`, tip: "Focus on the over-budget categories to improve this score." };
  }
  if (adherenceRate >= 0.5) {
    return { id: "budget_adherence", label: "Budget Adherence", score: 10, status: `${within} of ${budgets.length} budgets within limit. Multiple categories are over.`, tip: "Consider adjusting limits to realistic targets or reducing spending." };
  }
  if (adherenceRate >= 0.25) {
    return { id: "budget_adherence", label: "Budget Adherence", score: 5, status: `Most budgets are over limit — ${overCount} of ${budgets.length} exceeded.`, tip: "Start with one category and commit to staying within its limit for a month." };
  }
  return { id: "budget_adherence", label: "Budget Adherence", score: 0, status: `Nearly all budgets are over limit — ${overCount} of ${budgets.length} exceeded.`, tip: "Reset limits to realistic levels and track one category at a time." };
}

/** Rates credit card balance relative to total cash assets (0–20 pts). */
function scoreDebtRatio(cashBalance: number, creditBalance: number): SubScore {
  if (creditBalance <= 0) {
    return { id: "debt_ratio", label: "Debt Ratio", score: 20, status: "No credit card debt — full marks.", tip: null };
  }
  if (cashBalance <= 0) {
    return { id: "debt_ratio", label: "Debt Ratio", score: 0, status: "Debt exceeds all cash assets. Prioritise paying down credit balances.", tip: "Paying more than the minimum each month reduces debt faster." };
  }
  const ratio = creditBalance / cashBalance;
  const pct = `${(ratio * 100).toFixed(0)}%`;
  if (ratio < 0.05) {
    return { id: "debt_ratio", label: "Debt Ratio", score: 18, status: `Credit balance is ${pct} of cash assets — minimal debt.`, tip: `Paying off the remaining ${formatCurrency(creditBalance)} would earn full marks.` };
  }
  if (ratio < 0.15) {
    return { id: "debt_ratio", label: "Debt Ratio", score: 14, status: `Credit balance is ${pct} of cash assets — manageable.`, tip: "Reducing this ratio below 5% of cash would improve your score." };
  }
  if (ratio < 0.3) {
    return { id: "debt_ratio", label: "Debt Ratio", score: 10, status: `Credit balance is ${pct} of cash assets — moderate debt.`, tip: "Aim to reduce credit balances before adding to savings." };
  }
  if (ratio < 0.5) {
    return { id: "debt_ratio", label: "Debt Ratio", score: 5, status: `Credit balance is ${pct} of cash assets — high debt relative to savings.`, tip: "High-interest debt costs more than most savings earn. Prioritise repayment." };
  }
  if (ratio < 1.0) {
    return { id: "debt_ratio", label: "Debt Ratio", score: 2, status: `Credit balance is ${pct} of cash assets — debt is close to your total cash holdings.`, tip: "Focus aggressively on paying down credit card balances." };
  }
  return { id: "debt_ratio", label: "Debt Ratio", score: 0, status: "Credit balance exceeds total cash assets — net worth is negative.", tip: "Prioritise debt repayment above all other financial goals." };
}

/** Rates months of expenses covered by liquid savings (chequing + savings accounts) (0–20 pts). */
function scoreEmergencyCoverage(liquidBalance: number, monthlySpending: number): SubScore {
  if (monthlySpending <= 0) {
    return { id: "emergency_coverage", label: "Emergency Coverage", score: 10, status: "No spending recorded this period — score is neutral.", tip: "Record spending to see your emergency fund coverage." };
  }
  const months = liquidBalance / monthlySpending;
  const monthsStr = months.toFixed(1);
  if (months >= 6) {
    return { id: "emergency_coverage", label: "Emergency Coverage", score: 20, status: `${monthsStr} months of expenses covered — excellent emergency fund.`, tip: null };
  }
  if (months >= 3) {
    return { id: "emergency_coverage", label: "Emergency Coverage", score: 15, status: `${monthsStr} months of expenses covered. The 3–6 month target is met.`, tip: "Building toward 6 months would achieve full marks." };
  }
  if (months >= 2) {
    return { id: "emergency_coverage", label: "Emergency Coverage", score: 10, status: `${monthsStr} months of expenses covered. Target is 3–6 months.`, tip: "Add to your savings account to build a stronger emergency buffer." };
  }
  if (months >= 1) {
    return { id: "emergency_coverage", label: "Emergency Coverage", score: 6, status: `${monthsStr} months of expenses covered — below the recommended minimum.`, tip: "A 3-month emergency fund can prevent costly debt during unexpected events." };
  }
  return { id: "emergency_coverage", label: "Emergency Coverage", score: 0, status: "Less than 1 month of expenses in liquid savings — no emergency cushion.", tip: "Start by saving one month of expenses in a dedicated savings account." };
}

/** Rates the direction net worth is moving month-over-month (0–20 pts). */
function scoreNetWorthTrend(history: NetWorthSnapshot[]): SubScore {
  if (history.length < 2) {
    return { id: "net_worth_trend", label: "Net Worth Trend", score: 10, status: "Not enough history to assess trend — score is neutral.", tip: "Continue using Bloom to build up a net worth history." };
  }
  const latest = history[history.length - 1]!;
  const previous = history[history.length - 2]!;
  const trend = latest.netWorth - previous.netWorth;
  const isPositive = latest.netWorth > 0;
  const trendStr = trend >= 0 ? `+${formatCurrency(trend)}` : formatCurrency(trend);

  if (trend > 50 && isPositive) {
    return { id: "net_worth_trend", label: "Net Worth Trend", score: 20, status: `Net worth is positive and growing (${trendStr} last month).`, tip: null };
  }
  if (trend > 50 && !isPositive) {
    return { id: "net_worth_trend", label: "Net Worth Trend", score: 14, status: `Net worth is improving (${trendStr}) but still negative — heading in the right direction.`, tip: "Keep the trend going and net worth will turn positive." };
  }
  if (Math.abs(trend) <= 50 && isPositive) {
    return { id: "net_worth_trend", label: "Net Worth Trend", score: 12, status: "Net worth is positive and holding steady.", tip: "Growing net worth month-over-month would reach full marks." };
  }
  if (Math.abs(trend) <= 50 && !isPositive) {
    return { id: "net_worth_trend", label: "Net Worth Trend", score: 6, status: "Net worth is negative and flat — no recent improvement.", tip: "Increasing savings or reducing debt will start moving this number up." };
  }
  if (trend < -50 && isPositive) {
    return { id: "net_worth_trend", label: "Net Worth Trend", score: 5, status: `Net worth declined (${trendStr} last month) but is still positive overall.`, tip: "Investigate whether the decline was a one-time expense or a recurring pattern." };
  }
  return { id: "net_worth_trend", label: "Net Worth Trend", score: 0, status: `Net worth declined (${trendStr}) and remains negative.`, tip: "Focus on reducing debt and increasing income to reverse this trend." };
}

/** Maps a total score (0–100) to a letter grade and descriptive label. */
function gradeFromTotal(total: number): { grade: ScoreGrade; label: string } {
  if (total >= 85) return { grade: "A", label: "Excellent" };
  if (total >= 70) return { grade: "B", label: "Good" };
  if (total >= 50) return { grade: "C", label: "Fair" };
  if (total >= 35) return { grade: "D", label: "Needs Work" };
  return { grade: "F", label: "Critical" };
}

/** Computes the overall financial health score and all five sub-scores from existing dashboard data. */
export function computeHealthScore({
  accounts,
  budgets,
  monthlySummary,
  netWorthHistory,
}: HealthScoreInputs): HealthScore {
  const cashBalance = accounts
    .filter((a) => a.accountType !== "CREDIT")
    .reduce((sum, a) => sum + a.balance, 0);
  const creditBalance = accounts
    .filter((a) => a.accountType === "CREDIT")
    .reduce((sum, a) => sum + a.balance, 0);
  const liquidBalance = accounts
    .filter((a) => a.accountType === "CHEQUING" || a.accountType === "SAVINGS")
    .reduce((sum, a) => sum + a.balance, 0);

  const subScores: SubScore[] = [
    scoreSavingsRate(monthlySummary.income, monthlySummary.netCashFlow),
    scoreBudgetAdherence(budgets),
    scoreDebtRatio(cashBalance, creditBalance),
    scoreEmergencyCoverage(liquidBalance, monthlySummary.spending),
    scoreNetWorthTrend(netWorthHistory),
  ];

  const total = subScores.reduce((sum, s) => sum + s.score, 0);
  const { grade, label } = gradeFromTotal(total);

  return { total, grade, label, subScores };
}
