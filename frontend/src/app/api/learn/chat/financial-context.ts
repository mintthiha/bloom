import type {
  Account,
  AccountType,
  Budget,
  MonthlySummary,
  Profile,
  RecurringTransaction,
  SavingsGoal,
  SubscriptionSummary,
  Transaction,
} from "@/lib/api";
import { calculateNetContributions, calculateTfsaLifetimeRoom } from "@/lib/contribution-room";
import { formatCurrency } from "@/lib/format";
import { computeSafeToSpend } from "@/lib/safe-to-spend";

/** Everything the context builder needs for one user, already fetched from the backend. */
export type FinancialSnapshot = {
  accounts: Account[];
  monthlySummary: MonthlySummary | null;
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  subscriptions: SubscriptionSummary | null;
  recurringTransactions: RecurringTransaction[];
  profile: Profile | null;
  /** Transactions for the user's registered accounts, keyed by type, for contribution-room math. */
  registeredTransactions: Partial<Record<AccountType, Transaction[]>>;
};

/** Human-readable labels for each account type, used when listing balances. */
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHEQUING: "Chequing",
  SAVINGS: "Savings",
  TFSA: "TFSA",
  RRSP: "RRSP",
  FHSA: "FHSA",
  CREDIT: "Credit",
};

/** Stable display order so the balances line reads the same regardless of account creation order. */
const ACCOUNT_TYPE_ORDER: AccountType[] = ["CHEQUING", "SAVINGS", "TFSA", "RRSP", "FHSA", "CREDIT"];

/** Net worth plus a per-type balance breakdown, matching the backend's assets-minus-debt convention. */
function summarizeAccounts(accounts: Account[]): string {
  const totalAssets = accounts
    .filter((account) => account.accountType !== "CREDIT")
    .reduce((sum, account) => sum + account.balance, 0);
  const totalDebt = accounts
    .filter((account) => account.accountType === "CREDIT")
    .reduce((sum, account) => sum + account.balance, 0);
  const netWorth = totalAssets - totalDebt;

  const balanceByType = new Map<AccountType, number>();
  for (const account of accounts) {
    balanceByType.set(
      account.accountType,
      (balanceByType.get(account.accountType) ?? 0) + account.balance
    );
  }
  const balanceParts = ACCOUNT_TYPE_ORDER.filter((type) => balanceByType.has(type)).map(
    (type) => `${ACCOUNT_TYPE_LABELS[type]} ${formatCurrency(balanceByType.get(type)!)}`
  );

  return (
    `Net worth ${formatCurrency(netWorth)} (assets ${formatCurrency(totalAssets)}, ` +
    `debt ${formatCurrency(totalDebt)}) across ${accounts.length} account(s). ` +
    `Balances by type: ${balanceParts.join("; ")}.`
  );
}

/** This month's income, spending, net cash flow, and top spending category. */
function summarizeCashFlow(monthlySummary: MonthlySummary | null): string | null {
  if (!monthlySummary) return null;
  let line =
    `This month — income ${formatCurrency(monthlySummary.income)}, ` +
    `spending ${formatCurrency(monthlySummary.spending)}, ` +
    `net cash flow ${formatCurrency(monthlySummary.netCashFlow)}.`;
  if (monthlySummary.topExpenseCategory) {
    const topCategory = monthlySummary.categories.find(
      (category) => category.category === monthlySummary.topExpenseCategory
    );
    line +=
      ` Top spending category: ${monthlySummary.topExpenseCategory}` +
      `${topCategory ? ` (${formatCurrency(topCategory.spending)})` : ""}.`;
  }
  return line;
}

/** How much is free to spend for the rest of the month, using the app's own safe-to-spend logic. */
function summarizeSafeToSpend(
  accounts: Account[],
  recurringTransactions: RecurringTransaction[],
  referenceDate: Date
): string | null {
  if (accounts.length === 0) return null;
  const result = computeSafeToSpend(accounts, recurringTransactions, referenceDate);
  return (
    `Safe to spend for the rest of the month: ${formatCurrency(result.safeToSpend)} ` +
    `(${formatCurrency(result.perDay)}/day over ${result.daysRemaining} day(s)), after ` +
    `${formatCurrency(result.expectedIncome)} expected income and ` +
    `${formatCurrency(result.upcomingBills)} upcoming bills.`
  );
}

/** Which budgets are over their limit, or a note that all are within limit. */
function summarizeBudgets(budgets: Budget[]): string | null {
  if (budgets.length === 0) return null;
  const overBudget = budgets.filter((budget) => budget.isOverBudget);
  if (overBudget.length === 0) {
    return `Budgets: ${budgets.length} set, all within limit.`;
  }
  const parts = overBudget.map(
    (budget) =>
      `${budget.category} (${formatCurrency(budget.currentSpending)}/${formatCurrency(budget.limit)})`
  );
  return `Budgets over limit: ${parts.join("; ")}.`;
}

/** Progress toward each savings goal. */
function summarizeGoals(savingsGoals: SavingsGoal[]): string | null {
  if (savingsGoals.length === 0) return null;
  const parts = savingsGoals.map(
    (goal) =>
      `${goal.name} ${Math.round(goal.percentageReached)}% ` +
      `(${formatCurrency(goal.currentBalance)}/${formatCurrency(goal.targetAmount)})`
  );
  return `Savings goals: ${parts.join("; ")}.`;
}

/** Total recurring subscription cost, if any subscriptions were detected. */
function summarizeSubscriptions(subscriptions: SubscriptionSummary | null): string | null {
  if (!subscriptions || subscriptions.count === 0) return null;
  return (
    `Subscriptions: ${subscriptions.count} totalling ` +
    `${formatCurrency(subscriptions.monthlyTotal)}/month ` +
    `(${formatCurrency(subscriptions.annualTotal)}/year).`
  );
}

/** Estimated TFSA room used vs. remaining, mirroring the TFSA contribution-room panel. */
function summarizeTfsaRoom(snapshot: FinancialSnapshot, referenceDate: Date): string | null {
  const { profile, accounts, registeredTransactions } = snapshot;
  if (!profile || profile.tfsaBirthYear == null) return null;
  const tfsaAccountIds = accounts
    .filter((account) => account.accountType === "TFSA")
    .map((account) => account.id);
  if (tfsaAccountIds.length === 0) return null;

  const lifetimeRoom = calculateTfsaLifetimeRoom(
    profile.tfsaBirthYear,
    referenceDate.getFullYear()
  );
  const netContributions = calculateNetContributions(
    registeredTransactions.TFSA ?? [],
    tfsaAccountIds
  );
  const totalUsed = netContributions + (profile.tfsaRoomUsedElsewhere ?? 0);
  const remaining = lifetimeRoom - totalUsed;
  return (
    `TFSA room — about ${formatCurrency(totalUsed)} used of ${formatCurrency(lifetimeRoom)} ` +
    `lifetime room, roughly ${formatCurrency(remaining)} remaining` +
    `${remaining < 0 ? " (over-contributed)" : ""}.`
  );
}

/** RRSP deduction room remaining, mirroring the RRSP contribution-room panel. */
function summarizeRrspRoom(snapshot: FinancialSnapshot): string | null {
  const { profile, accounts, registeredTransactions } = snapshot;
  if (!profile || profile.rrspContributionRoom == null) return null;
  const rrspAccountIds = accounts
    .filter((account) => account.accountType === "RRSP")
    .map((account) => account.id);
  const netContributions = calculateNetContributions(
    registeredTransactions.RRSP ?? [],
    rrspAccountIds
  );
  const remaining = profile.rrspContributionRoom - netContributions;
  return (
    `RRSP room — deduction limit ${formatCurrency(profile.rrspContributionRoom)}, about ` +
    `${formatCurrency(netContributions)} contributed in Bloom, roughly ` +
    `${formatCurrency(remaining)} remaining.`
  );
}

/**
 * Turns a user's fetched financial data into a compact plain-text snapshot for the AI's system
 * prompt, so answers can reference the person's real numbers. Returns an empty string when the
 * user has no accounts, so the caller can fall back to the generic (non-personalized) prompt.
 * `referenceDate` is injectable to keep the output deterministic under test.
 */
export function buildFinancialContext(
  snapshot: FinancialSnapshot,
  referenceDate: Date = new Date()
): string {
  if (snapshot.accounts.length === 0) return "";

  const lines = [
    summarizeAccounts(snapshot.accounts),
    summarizeCashFlow(snapshot.monthlySummary),
    summarizeSafeToSpend(snapshot.accounts, snapshot.recurringTransactions, referenceDate),
    summarizeBudgets(snapshot.budgets),
    summarizeGoals(snapshot.savingsGoals),
    summarizeSubscriptions(snapshot.subscriptions),
    summarizeTfsaRoom(snapshot, referenceDate),
    summarizeRrspRoom(snapshot),
  ].filter((line): line is string => line !== null);

  const asOf = referenceDate.toISOString().slice(0, 10);
  return [
    `USER FINANCIAL SNAPSHOT (Bloom data, as of ${asOf}). Ground your answers in these figures ` +
      `when the user asks about their own money; never invent numbers beyond them, and keep ` +
      `framing this as education, not personalized advice.`,
    ...lines.map((line) => `- ${line}`),
  ].join("\n");
}
