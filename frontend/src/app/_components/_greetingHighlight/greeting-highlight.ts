import {
  Account,
  Budget,
  MonthlySummary,
  PrimaryFinancialGoal,
  RecurringTransaction,
  SavingsGoal,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { generateInsights, InsightSeverity } from "../_insights/insights";

export type GreetingHighlightTone = "positive" | "warning" | "neutral";

export type GreetingHighlight = {
  id: string;
  tone: GreetingHighlightTone;
  text: string;
};

export type GreetingHighlightInput = {
  accounts: Account[];
  budgets: Budget[];
  goals: SavingsGoal[];
  monthlySummary: MonthlySummary | null;
  previousMonthlySummary: MonthlySummary | null;
  recurringRules: RecurringTransaction[];
  primaryFinancialGoal: PrimaryFinancialGoal | null;
  /** Injectable clock so the "days left this month" wording is testable. */
  now?: Date;
};

/** Average number of weeks in a month, used to turn a monthly surplus into a weeks-to-target estimate. */
const WEEKS_PER_MONTH = 4.345;

/** Months of expenses a fully-funded starter emergency fund should cover. */
const EMERGENCY_FUND_TARGET_MONTHS = 3;

/**
 * Which highlight the hero prefers, per the user's stated primary goal. The first candidate that
 * has enough data to produce a line wins, so later entries act as graceful fallbacks.
 */
const HIGHLIGHT_PRIORITY_BY_GOAL: Record<PrimaryFinancialGoal | "DEFAULT", string[]> = {
  EMERGENCY_FUND: [
    "emergency-fund",
    "over-budget",
    "savings-goal",
    "spending-pace",
    "under-budget",
    "credit-payoff",
  ],
  PAY_OFF_DEBT: [
    "credit-payoff",
    "over-budget",
    "spending-pace",
    "under-budget",
    "savings-goal",
    "emergency-fund",
  ],
  BIG_PURCHASE: [
    "savings-goal",
    "over-budget",
    "spending-pace",
    "under-budget",
    "emergency-fund",
    "credit-payoff",
  ],
  TRACK_SPENDING: [
    "over-budget",
    "under-budget",
    "spending-pace",
    "savings-goal",
    "emergency-fund",
    "credit-payoff",
  ],
  DEFAULT: [
    "over-budget",
    "emergency-fund",
    "savings-goal",
    "spending-pace",
    "under-budget",
    "credit-payoff",
  ],
};

/** Formats a whole-dollar amount in the user's active display currency, without cents. */
function formatWholeAmount(amount: number): string {
  return formatCurrency(amount, { hideCents: true });
}

/**
 * Turns a remaining amount plus a monthly surplus into human wording like "3 weeks" or
 * "about 5 months". Returns null when there is no surplus to project from, or when the
 * horizon is so far out that a number would be misleading.
 */
export function formatTimeToTarget(
  remainingAmount: number,
  monthlyContribution: number
): string | null {
  if (remainingAmount <= 0 || monthlyContribution <= 0) return null;

  const weeks = Math.ceil(remainingAmount / (monthlyContribution / WEEKS_PER_MONTH));
  if (weeks <= 1) return "less than a week";
  if (weeks <= 8) return `${weeks} weeks`;

  const months = Math.round(remainingAmount / monthlyContribution);
  if (months <= 1) return "about a month";
  if (months <= 18) return `about ${months} months`;
  return null;
}

/** Counts the days remaining in the month containing `today`, excluding today itself. */
function countDaysLeftInMonth(today: Date): number {
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
}

/** Renders "9 days to go" / "1 day to go" for budget wording. */
function formatDaysLeftPhrase(daysLeftInMonth: number): string {
  return `${daysLeftInMonth} day${daysLeftInMonth !== 1 ? "s" : ""} to go`;
}

/** The worst over-budget category, phrased as the overage the user still has to absorb. */
function buildOverBudgetHighlight(
  budgets: Budget[],
  daysLeftInMonth: number
): GreetingHighlight | null {
  const overBudgetItems = budgets.filter((budget) => budget.isOverBudget);
  if (overBudgetItems.length === 0) return null;

  const worst = overBudgetItems.reduce((a, b) =>
    a.currentSpending - a.monthlyLimit > b.currentSpending - b.monthlyLimit ? a : b
  );
  const overage = worst.currentSpending - worst.monthlyLimit;
  return {
    id: "over-budget",
    tone: "warning",
    text: `You're ${formatWholeAmount(overage)} over on ${worst.category} this month, with ${formatDaysLeftPhrase(daysLeftInMonth)}.`,
  };
}

/**
 * The category with the most room left, as encouragement. Requires some spending in it so a
 * brand-new, untouched budget is not celebrated as progress.
 */
function buildUnderBudgetHighlight(
  budgets: Budget[],
  daysLeftInMonth: number
): GreetingHighlight | null {
  const activeUnderBudget = budgets.filter(
    (budget) => !budget.isOverBudget && budget.currentSpending > 0 && budget.monthlyLimit > 0
  );
  if (activeUnderBudget.length === 0) return null;

  const best = activeUnderBudget.reduce((a, b) =>
    a.monthlyLimit - a.currentSpending > b.monthlyLimit - b.currentSpending ? a : b
  );
  const remaining = best.monthlyLimit - best.currentSpending;
  if (remaining <= 0) return null;

  return {
    id: "under-budget",
    tone: "positive",
    text: `You're ${formatWholeAmount(remaining)} under on ${best.category} this month, with ${formatDaysLeftPhrase(daysLeftInMonth)}.`,
  };
}

/**
 * Emergency fund status against a 3-month cushion, projected forward from this month's surplus
 * when there is one so the line reads as a countdown rather than a static ratio.
 */
function buildEmergencyFundHighlight(
  accounts: Account[],
  monthlySummary: MonthlySummary,
  previousMonthlySummary: MonthlySummary | null
): GreetingHighlight | null {
  const liquidAccounts = accounts.filter(
    (account) => account.accountType === "CHEQUING" || account.accountType === "SAVINGS"
  );
  // Without a cash account there is no fund to report on, and "$0 of a $3,000 cushion" is noise.
  if (liquidAccounts.length === 0) return null;

  const liquidBalance = liquidAccounts.reduce((sum, account) => sum + account.balance, 0);
  const referenceSpending =
    (previousMonthlySummary?.spending ?? 0) > 0
      ? previousMonthlySummary!.spending
      : monthlySummary.spending;
  if (referenceSpending <= 0) return null;

  const targetBalance = referenceSpending * EMERGENCY_FUND_TARGET_MONTHS;
  if (liquidBalance >= targetBalance) {
    return {
      id: "emergency-fund",
      tone: "positive",
      text: `Your emergency fund is full — ${formatWholeAmount(liquidBalance)} covers ${(liquidBalance / referenceSpending).toFixed(1)} months of expenses.`,
    };
  }

  const remaining = targetBalance - liquidBalance;
  const timeToTarget = formatTimeToTarget(remaining, monthlySummary.netCashFlow);
  if (timeToTarget) {
    return {
      id: "emergency-fund",
      tone: "neutral",
      text: `Emergency fund is ${timeToTarget} from full — ${formatWholeAmount(remaining)} to go.`,
    };
  }

  const monthsCovered = liquidBalance / referenceSpending;
  return {
    id: "emergency-fund",
    tone: monthsCovered < 1 ? "warning" : "neutral",
    text: `Emergency fund covers ${monthsCovered.toFixed(1)} months — ${formatWholeAmount(remaining)} short of a ${EMERGENCY_FUND_TARGET_MONTHS}-month cushion.`,
  };
}

/** The savings goal closest to done, projected from this month's surplus when possible. */
function buildSavingsGoalHighlight(
  goals: SavingsGoal[],
  monthlySummary: MonthlySummary
): GreetingHighlight | null {
  const fundableGoals = goals.filter((goal) => goal.targetAmount > 0);
  if (fundableGoals.length === 0) return null;

  const unfinishedGoals = fundableGoals.filter((goal) => goal.currentBalance < goal.targetAmount);
  if (unfinishedGoals.length === 0) {
    return {
      id: "savings-goal",
      tone: "positive",
      text:
        fundableGoals.length === 1
          ? `${fundableGoals[0].name} is fully funded.`
          : `All ${fundableGoals.length} of your savings goals are fully funded.`,
    };
  }

  const closest = unfinishedGoals.reduce((a, b) =>
    a.percentageReached >= b.percentageReached ? a : b
  );
  const remaining = closest.targetAmount - closest.currentBalance;
  const timeToTarget = formatTimeToTarget(remaining, monthlySummary.netCashFlow);
  if (timeToTarget) {
    return {
      id: "savings-goal",
      tone: "neutral",
      text: `${closest.name} is ${timeToTarget} from full — ${formatWholeAmount(remaining)} to go.`,
    };
  }

  return {
    id: "savings-goal",
    tone: "neutral",
    text: `${closest.name} is ${Math.round(closest.percentageReached)}% funded — ${formatWholeAmount(remaining)} to go.`,
  };
}

/** Outstanding credit balance, projected against this month's surplus when there is one. */
function buildCreditPayoffHighlight(
  accounts: Account[],
  monthlySummary: MonthlySummary
): GreetingHighlight | null {
  const amountOwed = accounts
    .filter((account) => account.accountType === "CREDIT")
    .reduce((sum, account) => sum + account.balance, 0);
  if (amountOwed <= 0) return null;

  const timeToTarget = formatTimeToTarget(amountOwed, monthlySummary.netCashFlow);
  if (timeToTarget) {
    return {
      id: "credit-payoff",
      tone: "neutral",
      text: `You're ${timeToTarget} from clearing ${formatWholeAmount(amountOwed)} of credit debt at this month's pace.`,
    };
  }

  return {
    id: "credit-payoff",
    tone: "warning",
    text: `You owe ${formatWholeAmount(amountOwed)} on credit, and this month hasn't left a surplus to pay it down.`,
  };
}

/** This month's spending compared with the previous period, so the user sees the direction of travel. */
function buildSpendingPaceHighlight(
  monthlySummary: MonthlySummary,
  previousMonthlySummary: MonthlySummary | null
): GreetingHighlight | null {
  if (!previousMonthlySummary) return null;
  if (monthlySummary.spending <= 0 || previousMonthlySummary.spending <= 0) return null;

  const difference = monthlySummary.spending - previousMonthlySummary.spending;
  const percentageChange = Math.abs(difference) / previousMonthlySummary.spending;
  if (percentageChange < 0.05) {
    return {
      id: "spending-pace",
      tone: "neutral",
      text: `You've spent ${formatWholeAmount(monthlySummary.spending)} this month — right in line with last month.`,
    };
  }

  return {
    id: "spending-pace",
    tone: difference < 0 ? "positive" : "warning",
    text: `You've spent ${formatWholeAmount(monthlySummary.spending)} this month — ${formatWholeAmount(Math.abs(difference))} ${difference < 0 ? "less" : "more"} than last month.`,
  };
}

/** Maps the insights card's severity vocabulary onto the hero's tone vocabulary. */
const TONE_BY_INSIGHT_SEVERITY: Record<InsightSeverity, GreetingHighlightTone> = {
  warning: "warning",
  info: "neutral",
  success: "positive",
};

/**
 * Falls back to the top-ranked dashboard insight (overdue bills, idle cash, missing budgets) so the
 * hero still says something concrete when none of the goal-specific derivations have data.
 */
function buildTopInsightHighlight(input: GreetingHighlightInput): GreetingHighlight | null {
  if (!input.monthlySummary) return null;

  const [topInsight] = generateInsights({
    accounts: input.accounts,
    budgets: input.budgets,
    monthlySummary: input.monthlySummary,
    previousMonthlySummary: input.previousMonthlySummary,
    recurringRules: input.recurringRules,
  });
  if (!topInsight) return null;

  return {
    id: "top-insight",
    tone: TONE_BY_INSIGHT_SEVERITY[topInsight.severity],
    text: `${topInsight.message}.`,
  };
}

/**
 * Picks the single most relevant concrete line for the dashboard hero, ranked by the user's
 * primary financial goal. Returns null when there isn't enough data to say anything specific.
 */
export function selectGreetingHighlight(input: GreetingHighlightInput): GreetingHighlight | null {
  const { accounts, budgets, goals, monthlySummary, previousMonthlySummary } = input;
  if (!monthlySummary) return null;

  const today = input.now ? new Date(input.now) : new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeftInMonth = countDaysLeftInMonth(today);

  const candidatesById = new Map<string, GreetingHighlight>();
  /** Registers a candidate under its own id, skipping the ones that had no data to work with. */
  function register(candidate: GreetingHighlight | null) {
    if (candidate) candidatesById.set(candidate.id, candidate);
  }

  register(buildOverBudgetHighlight(budgets, daysLeftInMonth));
  register(buildUnderBudgetHighlight(budgets, daysLeftInMonth));
  register(buildEmergencyFundHighlight(accounts, monthlySummary, previousMonthlySummary));
  register(buildSavingsGoalHighlight(goals, monthlySummary));
  register(buildCreditPayoffHighlight(accounts, monthlySummary));
  register(buildSpendingPaceHighlight(monthlySummary, previousMonthlySummary));

  const priority =
    HIGHLIGHT_PRIORITY_BY_GOAL[input.primaryFinancialGoal ?? "DEFAULT"] ??
    HIGHLIGHT_PRIORITY_BY_GOAL.DEFAULT;
  for (const candidateId of priority) {
    const candidate = candidatesById.get(candidateId);
    if (candidate) return candidate;
  }

  return buildTopInsightHighlight(input);
}
