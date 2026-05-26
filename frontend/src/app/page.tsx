"use client";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  api,
  Account,
  Budget,
  DateRangeQuery,
  MonthlyTrend,
  MonthlySummary,
  NetWorthSnapshot,
  Profile,
  RecurringTransaction,
  SavingsGoal,
} from "@/lib/api";
import { DateRangeControls } from "@/components/date-range-controls";
import { useDashboardView } from "@/components/dashboard-view-provider";
import { ProfileFormPanel } from "@/components/profile-form-panel";
import {
  buildDateRangeQuery,
  DateRangeState,
  getBrowserTimeZone,
  getPresetDateRange,
} from "@/lib/date-range";
import { formatCurrency } from "@/lib/format";
import { getCachedFirstName, setCachedFirstName, getGreeting } from "@/lib/profile-cache";
import { DraggableAccountList } from "./_components/_accountList/DraggableAccountList";
import { GoalWidget } from "./_components/_goalWidget/GoalWidget";
import { MonthlySnapshot } from "./_components/_monthlySnapshot/MonthlySnapshot";
import { BudgetsCard } from "./_components/_budgets/BudgetsCard";
import { RecurringTransactionsCard } from "./_components/_recurringTransactions/RecurringTransactionsCard";
import { RecurringCalendar } from "./_components/_recurringCalendar/RecurringCalendar";
import { NetWorthHistory } from "./_components/_netWorthHistory/NetWorthHistory";
import { AccountBalancesCard } from "./_components/_accountBalances/AccountBalancesCard";
import { OpenAccountCard } from "./_components/_openAccount/OpenAccountCard";
import { InsightsCard } from "./_components/_insights/InsightsCard";
import { BudgetRuleCard } from "./_components/_budgetRule/BudgetRuleCard";
import { FinancialHealthScore } from "./_components/_financialHealth/FinancialHealthScore";
import { DashboardSkeleton } from "./_components/_dashboardSkeleton/DashboardSkeleton";

function Home() {
  const { view } = useDashboardView();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(
    null,
  );
  const [previousMonthlySummary, setPreviousMonthlySummary] =
    useState<MonthlySummary | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>(
    [],
  );
  const [recurringRules, setRecurringRules] = useState<RecurringTransaction[]>(
    [],
  );
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [cachedFirstName, setCachedFirstNameState] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeState>(() =>
    getPresetDateRange("this-month"),
  );
  const [timeZone, setTimeZone] = useState("UTC");
  const searchParams = useSearchParams();
  const router = useRouter();

  const rangeQuery: DateRangeQuery | undefined = useMemo(
    () => buildDateRangeQuery(dateRange),
    [dateRange],
  );

  const dashboardColumns =
    view === "single" ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))";

  /** Keeps the date range fresh whenever the preset changes (e.g., "this-month" recalculates daily). */
  useEffect(() => {
    if (dateRange.preset !== "custom") {
      setDateRange(getPresetDateRange(dateRange.preset));
    }
  }, [dateRange.preset]);

  /** Detects the browser timezone for display. */
  useEffect(() => {
    setTimeZone(getBrowserTimeZone());
  }, []);

  /** Shows a toast when returning from an account deletion. */
  useEffect(() => {
    const deleted = searchParams.get("deleted");
    if (deleted) {
      toast.success(`${deleted} deleted`);
      router.replace("/");
    }
  }, []);

  /** Loads all dashboard data in parallel, then records and fetches net worth history. */
  const loadAccounts = useCallback(async () => {
    try {
      let previousRangeQuery: DateRangeQuery | undefined;
      if (rangeQuery) {
        const start = new Date(rangeQuery.start!);
        const end = new Date(rangeQuery.end!);
        const diffMs = end.getTime() - start.getTime();
        previousRangeQuery = {
          start: new Date(start.getTime() - diffMs).toISOString(),
          end: start.toISOString(),
        };
      }

      const [
        nextAccounts,
        nextSummary,
        nextPreviousSummary,
        nextBudgets,
        nextRecurringRules,
        nextTrends,
        nextGoals,
      ] = await Promise.all([
        api.listAccounts(),
        api.getMonthlySummary(rangeQuery),
        previousRangeQuery
          ? api.getMonthlySummary(previousRangeQuery)
          : Promise.resolve(null),
        api.getBudgets(rangeQuery),
        api.listRecurringTransactions(),
        api.getMonthlyTrends(6),
        api.listSavingsGoals(),
      ]);

      setAccounts(nextAccounts);
      setMonthlySummary(nextSummary);
      setPreviousMonthlySummary(nextPreviousSummary);
      setBudgets(nextBudgets);
      setRecurringRules(nextRecurringRules);
      setMonthlyTrends(nextTrends);
      setGoals(nextGoals);

      const [, nextHistory] = await Promise.all([
        api.recordNetWorthSnapshot(),
        api.getNetWorthHistory(12),
      ]);
      setNetWorthHistory(nextHistory);
    } finally {
      setLoading(false);
    }
  }, [rangeQuery]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /** Seeds the greeting name instantly from localStorage to avoid a flash on load. */
  useEffect(() => {
    const cached = getCachedFirstName();
    if (cached) setCachedFirstNameState(cached);
  }, []);

  /** Loads the user profile for the welcome greeting and onboarding gate. */
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const nextProfile = await api.getProfile();
        if (!cancelled) {
          setProfile(nextProfile);
          if (nextProfile?.firstName) {
            setCachedFirstName(nextProfile.firstName);
            setCachedFirstNameState(nextProfile.firstName);
          }
        }
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profileLoading && !profile) {
    return (
      <div
        style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}
      >
        <div className="fade-up" style={{ marginBottom: "24px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#f59e0b",
              marginBottom: "10px",
            }}
          >
            Welcome To Bloom
          </p>
          <h1
            style={{
              fontSize: "34px",
              fontWeight: 800,
              letterSpacing: "-0.6px",
              marginBottom: "8px",
            }}
          >
            Let&apos;s set up your account.
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "15px",
              maxWidth: "560px",
            }}
          >
            We need a few profile details before you start using Bloom. Your
            first and last name are prefilled from Google when available.
          </p>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          <div
            className="fade-up fade-up-1"
            style={{
              background: "linear-gradient(135deg, #18120a 0%, #111111 65%)",
              border: "1px solid #2a2112",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#f59e0b",
                marginBottom: "12px",
              }}
            >
              Step 1
            </p>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-0.4px",
                marginBottom: "8px",
              }}
            >
              Choose how your profile appears in Bloom
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                maxWidth: "520px",
              }}
            >
              Set your name, username, and email. Once this is saved, the
              dashboard and sidebar will use your Bloom profile instead of the
              raw Google session name.
            </p>
          </div>

          <ProfileFormPanel
            title="Create your profile"
            description="This is the first step of onboarding. You can update these details later from the profile page."
            submitLabel="Continue to Bloom"
            successMessage="Profile saved. Loading your dashboard..."
            onSaved={(savedProfile) => setProfile(savedProfile)}
          />
        </div>
      </div>
    );
  }

  /** Renders a small stat card for the summary row at the top of the dashboard. */
  function renderSummaryCard({
    title,
    value,
    color,
    targetAccount,
  }: {
    title: string;
    value: React.ReactNode;
    color?: string;
    targetAccount?: Account;
  }) {
    const clickable = Boolean(targetAccount);
    return (
      <button
        type="button"
        onClick={() => {
          if (targetAccount) router.push(`/account/${targetAccount.id}`);
        }}
        disabled={!clickable}
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "20px",
          textAlign: "left",
          cursor: clickable ? "pointer" : "default",
          opacity: clickable ? 1 : 0.9,
          transition: "border-color 0.15s, transform 0.15s",
        }}
        onMouseEnter={(e) => {
          if (clickable) {
            e.currentTarget.style.borderColor = "var(--border-hover)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-secondary)",
            marginBottom: "10px",
          }}
        >
          {title}
        </p>
        <div
          className="num"
          style={{
            fontSize: "22px",
            fontWeight: 500,
            color: color ?? "var(--text-primary)",
          }}
        >
          {value}
        </div>
      </button>
    );
  }

  const cashAccounts = accounts.filter((a) => a.accountType !== "CREDIT");
  const creditAccounts = accounts.filter((a) => a.accountType === "CREDIT");
  const chequingAccounts = accounts.filter((a) => a.accountType === "CHEQUING");
  const savingsAccounts = accounts.filter((a) => a.accountType === "SAVINGS");
  const registeredAccounts = accounts.filter(
    (a) =>
      a.accountType === "TFSA" ||
      a.accountType === "RRSP" ||
      a.accountType === "FHSA",
  );
  const totalCash = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalCredit = creditAccounts.reduce((sum, a) => sum + a.balance, 0);
  const netWorth = totalCash - totalCredit;

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px 48px",
      }}
    >
      {/* Welcome */}
      <div className="fade-up" style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: 800,
                letterSpacing: "-0.5px",
                marginBottom: "6px",
              }}
            >
              {cachedFirstName
                ? `${getGreeting()}, ${cachedFirstName}.`
                : `${getGreeting()}.`}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
              Here&apos;s your financial overview.
            </p>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "12px",
                marginTop: "6px",
              }}
            >
              Times shown in {timeZone}.
            </p>
          </div>
          <DateRangeControls value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton dashboardColumns={dashboardColumns} />
      ) : (
        <>
          {/* Stats row */}
          {accounts.length > 0 && (
            <div
              className="fade-up fade-up-1"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginBottom: "36px",
              }}
            >
              {renderSummaryCard({
                title: "Net Worth",
                value: formatCurrency(netWorth),
                color: netWorth >= 0 ? "#22c55e" : "#ef4444",
              })}
              {renderSummaryCard({
                title: "Total Cash",
                value: formatCurrency(totalCash),
                color: "#f59e0b",
                targetAccount: cashAccounts[0],
              })}
              {renderSummaryCard({
                title: "Chequing",
                value: (
                  <>
                    {chequingAccounts.length}{" "}
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                      acct{chequingAccounts.length !== 1 ? "s" : ""}
                    </span>
                  </>
                ),
                targetAccount: chequingAccounts[0],
              })}
              {renderSummaryCard({
                title: "Savings",
                value: (
                  <>
                    {savingsAccounts.length}{" "}
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                      acct{savingsAccounts.length !== 1 ? "s" : ""}
                    </span>
                  </>
                ),
                targetAccount: savingsAccounts[0],
              })}
              {renderSummaryCard({
                title: "Registered",
                value: (
                  <>
                    {registeredAccounts.length}{" "}
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                      acct{registeredAccounts.length !== 1 ? "s" : ""}
                    </span>
                  </>
                ),
                targetAccount: registeredAccounts[0],
              })}
              {renderSummaryCard({
                title: "Credit",
                value:
                  creditAccounts.length > 0 ? (
                    <>
                      {formatCurrency(totalCredit)}{" "}
                      <span
                        style={{ fontSize: "13px", color: "var(--text-muted)" }}
                      >
                        owed
                      </span>
                    </>
                  ) : (
                    <>
                      {creditAccounts.length}{" "}
                      <span
                        style={{ fontSize: "13px", color: "var(--text-muted)" }}
                      >
                        acct{creditAccounts.length !== 1 ? "s" : ""}
                      </span>
                    </>
                  ),
                color: creditAccounts.length > 0 ? "#ef4444" : undefined,
                targetAccount: creditAccounts[0],
              })}
            </div>
          )}

          {/* Goals + Financial Health + Insights + 50/30/20 Rule (2×2 grid) */}
          {accounts.length > 0 && monthlySummary && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: view === "single" ? "1fr" : "repeat(2, 1fr)",
                gap: "20px",
                alignItems: "start",
                marginBottom: "32px",
              }}
            >
              <GoalWidget goals={goals} />
              <FinancialHealthScore
                accounts={accounts}
                budgets={budgets}
                monthlySummary={monthlySummary}
                netWorthHistory={netWorthHistory}
              />
              <InsightsCard
                accounts={accounts}
                budgets={budgets}
                monthlySummary={monthlySummary}
                previousMonthlySummary={previousMonthlySummary}
                recurringRules={recurringRules}
              />
              <BudgetRuleCard monthlySummary={monthlySummary} rangeQuery={rangeQuery} />
            </div>
          )}

          {/* Monthly Snapshot + Budgets */}
          {accounts.length > 0 && monthlySummary && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: dashboardColumns,
                gap: "20px",
                alignItems: "start",
                marginBottom: "32px",
              }}
            >
              <MonthlySnapshot
                monthlySummary={monthlySummary}
                previousMonthlySummary={previousMonthlySummary}
                monthlyTrends={monthlyTrends}
                isCurrentMonth={dateRange.preset === "this-month"}
              />
              <BudgetsCard
                budgets={budgets}
                monthlySummary={monthlySummary}
                onChanged={loadAccounts}
              />
            </div>
          )}

          {/* Recurring Transactions + Upcoming Schedule */}
          {accounts.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: dashboardColumns,
                gap: "20px",
                alignItems: "start",
                marginBottom: "32px",
              }}
            >
              <RecurringTransactionsCard
                rules={recurringRules}
                accounts={accounts}
                onChanged={loadAccounts}
              />
              <RecurringCalendar rules={recurringRules} />
            </div>
          )}

          {/* Net Worth History */}
          {netWorthHistory.length > 0 && (
            <NetWorthHistory history={netWorthHistory} />
          )}

          {/* Account Balances + Open New Account */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: dashboardColumns,
              gap: "20px",
              alignItems: "start",
              marginBottom: "32px",
            }}
          >
            {accounts.length > 1 && <AccountBalancesCard accounts={accounts} />}
            <OpenAccountCard onCreated={loadAccounts} />
          </div>
        </>
      )}

      {/* Account list */}
      <div className="fade-up fade-up-3">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "14px",
          }}
        >
          <p
            style={{
              fontSize: "16px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-primary)",
            }}
          >
            Accounts
          </p>
          <span
            className="num"
            style={{ fontSize: "16px", color: "var(--text-primary)" }}
          >
            {accounts.length}
          </span>
        </div>
        <DraggableAccountList accounts={accounts} loading={loading} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
