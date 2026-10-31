import type {
  Account,
  Budget,
  DateRangeQuery,
  ManualEntry,
  MonthlySummary,
  MonthlyTrend,
  NetWorthSnapshot,
  Profile,
  RecurringTransaction,
  SavingsGoal,
} from "@/lib/api";
import type { CardId } from "@/components/dashboard-visibility-provider";
import { AccountBalancesCard } from "../_accountBalances/AccountBalancesCard";
import { BudgetRuleCard } from "../_budgetRule/BudgetRuleCard";
import { BudgetsCard } from "../_budgets/BudgetsCard";
import { FinancialHealthScore } from "../_financialHealth/FinancialHealthScore";
import { GoalWidget } from "../_goalWidget/GoalWidget";
import { InsightsCard } from "../_insights/InsightsCard";
import { ManualEntriesCard } from "../_manualEntries/ManualEntriesCard";
import { MonthlySnapshot } from "../_monthlySnapshot/MonthlySnapshot";
import { NetWorthHistory } from "../_netWorthHistory/NetWorthHistory";
import { RecurringCalendar } from "../_recurringCalendar/RecurringCalendar";
import { RecurringTransactionsCard } from "../_recurringTransactions/RecurringTransactionsCard";
import { SafeToSpendCard } from "../_safeToSpend/SafeToSpendCard";
import type { DashboardCard } from "./DraggableCardGrid";

/** Everything the reorderable dashboard cards are built from. */
export type DashboardCardInputs = {
  visibleCards: Set<CardId>;
  accounts: Account[];
  budgets: Budget[];
  monthlySummary: MonthlySummary | null;
  previousMonthlySummary: MonthlySummary | null;
  monthlyTrends: MonthlyTrend[];
  netWorthHistory: NetWorthSnapshot[];
  recurringRules: RecurringTransaction[];
  goals: SavingsGoal[];
  manualEntries: ManualEntry[];
  profile: Profile | null;
  rangeQuery: DateRangeQuery | undefined;
  /** Whether the selected range is the current month (the snapshot shows a forecast then). */
  isCurrentMonth: boolean;
  /** Freshly created account to highlight in the balances card. */
  newlyCreatedAccountId: string | null;
  /** Reloads the dashboard after a card changes data. */
  onChanged: () => Promise<void>;
};

/**
 * Builds the reorderable card set in default order. A card appears only if the user has it
 * visible and the data it needs exists: most cards need at least one account, the analysis
 * cards also need this period's summary, and net-worth history needs a recorded snapshot.
 */
export function buildDashboardCards(inputs: DashboardCardInputs): DashboardCard[] {
  const {
    visibleCards,
    accounts,
    budgets,
    monthlySummary,
    previousMonthlySummary,
    monthlyTrends,
    netWorthHistory,
    recurringRules,
    goals,
    manualEntries,
    profile,
    rangeQuery,
    isCurrentMonth,
    newlyCreatedAccountId,
    onChanged,
  } = inputs;
  const hasAccounts = accounts.length > 0;
  const cards: DashboardCard[] = [];

  if (hasAccounts && monthlySummary) {
    if (visibleCards.has("safe-to-spend")) {
      cards.push({
        id: "safe-to-spend",
        node: (
          <SafeToSpendCard accounts={accounts} recurringRules={recurringRules} profile={profile} />
        ),
      });
    }
    if (visibleCards.has("goals")) {
      cards.push({ id: "goals", node: <GoalWidget goals={goals} /> });
    }
    if (visibleCards.has("financial-health")) {
      cards.push({
        id: "financial-health",
        node: (
          <FinancialHealthScore
            accounts={accounts}
            budgets={budgets}
            monthlySummary={monthlySummary}
            netWorthHistory={netWorthHistory}
            manualEntries={manualEntries}
          />
        ),
      });
    }
    if (visibleCards.has("insights")) {
      cards.push({
        id: "insights",
        node: (
          <InsightsCard
            accounts={accounts}
            budgets={budgets}
            monthlySummary={monthlySummary}
            previousMonthlySummary={previousMonthlySummary}
            recurringRules={recurringRules}
          />
        ),
      });
    }
    if (visibleCards.has("budget-rule")) {
      cards.push({
        id: "budget-rule",
        node: <BudgetRuleCard monthlySummary={monthlySummary} rangeQuery={rangeQuery} />,
      });
    }
    if (visibleCards.has("monthly-snapshot")) {
      cards.push({
        id: "monthly-snapshot",
        node: (
          <MonthlySnapshot
            monthlySummary={monthlySummary}
            previousMonthlySummary={previousMonthlySummary}
            monthlyTrends={monthlyTrends}
            isCurrentMonth={isCurrentMonth}
          />
        ),
      });
    }
    if (visibleCards.has("budgets")) {
      cards.push({
        id: "budgets",
        anchorId: "budgets-card-section",
        node: (
          <BudgetsCard budgets={budgets} monthlySummary={monthlySummary} onChanged={onChanged} />
        ),
      });
    }
  }
  if (hasAccounts && visibleCards.has("recurring")) {
    cards.push({
      id: "recurring",
      node: (
        <RecurringTransactionsCard
          rules={recurringRules}
          accounts={accounts}
          onChanged={onChanged}
        />
      ),
    });
  }
  if (hasAccounts && visibleCards.has("calendar")) {
    cards.push({ id: "calendar", node: <RecurringCalendar rules={recurringRules} /> });
  }
  if (netWorthHistory.length > 0 && visibleCards.has("net-worth")) {
    cards.push({ id: "net-worth", node: <NetWorthHistory history={netWorthHistory} /> });
  }
  if (visibleCards.has("manual-entries")) {
    cards.push({ id: "manual-entries", node: <ManualEntriesCard entries={manualEntries} /> });
  }
  if (hasAccounts && visibleCards.has("account-balances")) {
    cards.push({
      id: "account-balances",
      anchorId: "account-balances-anchor",
      node: (
        <AccountBalancesCard
          accounts={accounts}
          newlyCreatedId={newlyCreatedAccountId ?? undefined}
        />
      ),
    });
  }
  return cards;
}
