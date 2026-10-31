import { useCallback, useState } from "react";
import {
  api,
  Account,
  Budget,
  DateRangeQuery,
  ManualEntry,
  MonthlySummary,
  MonthlyTrend,
  NetWorthSnapshot,
  RecurringTransaction,
  SavingsGoal,
} from "@/lib/api";
import { buildPreviousRangeQuery } from "./dashboard-ranges";

/**
 * Holds everything the dashboard cards read, and `loadDashboard` to (re)fetch it for the selected
 * range: all data in parallel, then a fresh net-worth snapshot and the history that includes it.
 * The caller decides what a failed load means (the initial one shows the error page).
 */
export function useDashboardData(rangeQuery: DateRangeQuery | undefined) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [previousMonthlySummary, setPreviousMonthlySummary] = useState<MonthlySummary | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /** Loads all dashboard data in parallel, then records and fetches net worth history. */
  const loadDashboard = useCallback(async () => {
    try {
      const previousRangeQuery = buildPreviousRangeQuery(rangeQuery);
      const [
        nextAccounts,
        nextSummary,
        nextPreviousSummary,
        nextBudgets,
        nextRecurringRules,
        nextTrends,
        nextGoals,
        nextManualEntries,
      ] = await Promise.all([
        api.listAccounts(),
        api.getMonthlySummary(rangeQuery),
        previousRangeQuery ? api.getMonthlySummary(previousRangeQuery) : Promise.resolve(null),
        api.getBudgets(rangeQuery),
        api.listRecurringTransactions(),
        api.getMonthlyTrends(6),
        api.listSavingsGoals(),
        api.listManualEntries(),
      ]);

      setAccounts(nextAccounts);
      setMonthlySummary(nextSummary);
      setPreviousMonthlySummary(nextPreviousSummary);
      setBudgets(nextBudgets);
      setRecurringRules(nextRecurringRules);
      setMonthlyTrends(nextTrends);
      setGoals(nextGoals);
      setManualEntries(nextManualEntries);

      const [, nextHistory] = await Promise.all([
        api.recordNetWorthSnapshot(),
        api.getNetWorthHistory(12),
      ]);
      setNetWorthHistory(nextHistory);
    } finally {
      setIsLoading(false);
    }
  }, [rangeQuery]);

  return {
    accounts,
    budgets,
    monthlySummary,
    previousMonthlySummary,
    monthlyTrends,
    netWorthHistory,
    recurringRules,
    goals,
    manualEntries,
    isLoading,
    loadDashboard,
  };
}
