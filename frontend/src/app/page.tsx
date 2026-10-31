"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import type { DateRangeQuery } from "@/lib/api";
import { useDashboardView } from "@/components/dashboard-view-provider";
import { useDashboardVisibility } from "@/components/dashboard-visibility-provider";
import { ServiceErrorPage } from "@/components/ServiceErrorPage";
import { buildDateRangeQuery, DateRangeState, getPresetDateRange } from "@/lib/date-range";
import { buildDashboardCards } from "./_components/_dashboardCards/buildDashboardCards";
import { DraggableCardGrid } from "./_components/_dashboardCards/DraggableCardGrid";
import {
  getDashboardColumns,
  getTwoColumnGrid,
} from "./_components/_dashboardData/dashboard-ranges";
import { useDashboardData } from "./_components/_dashboardData/useDashboardData";
import {
  useAccountDeletedToast,
  useApplyDueRecurringOnLoad,
} from "./_components/_dashboardData/useDashboardLoadEffects";
import { useDashboardProfile } from "./_components/_dashboardData/useDashboardProfile";
import { DashboardHeader } from "./_components/_dashboardHeader/DashboardHeader";
import { DashboardSkeleton } from "./_components/_dashboardSkeleton/DashboardSkeleton";
import { ManageAccountsSection } from "./_components/_manageAccounts/ManageAccountsSection";
import { OnboardingChecklist } from "./_components/_onboardingChecklist/OnboardingChecklist";
import { ProfileOnboarding } from "./_components/_profileOnboarding/ProfileOnboarding";
import { SummaryStatsRow } from "./_components/_summaryStats/SummaryStatsRow";

/** The dashboard: loads everything, then shows onboarding, the error page, or the card grid. */
function Home() {
  const { effectiveView } = useDashboardView();
  const { visibleCards } = useDashboardVisibility();
  const [hasLoadFailed, setHasLoadFailed] = useState(false);
  const [newlyCreatedAccountId, setNewlyCreatedAccountId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeState>(() =>
    getPresetDateRange("this-month")
  );

  const rangeQuery: DateRangeQuery | undefined = useMemo(
    () => buildDateRangeQuery(dateRange),
    [dateRange]
  );
  const dashboard = useDashboardData(rangeQuery);
  const { loadDashboard } = dashboard;
  const { profile, isProfileLoading, cachedFirstName, handleProfileSaved } = useDashboardProfile(
    () => setHasLoadFailed(true)
  );
  useApplyDueRecurringOnLoad(loadDashboard);
  useAccountDeletedToast(loadDashboard);

  const dashboardColumns = getDashboardColumns(effectiveView);

  /** Keeps the date range fresh whenever the preset changes (e.g., "this-month" recalculates daily). */
  useEffect(() => {
    if (dateRange.preset !== "custom") {
      setDateRange(getPresetDateRange(dateRange.preset));
    }
  }, [dateRange.preset]);

  /** Loads the dashboard on mount and whenever the date range changes; a failure swaps in the error page. */
  useEffect(() => {
    loadDashboard().catch(() => setHasLoadFailed(true));
  }, [loadDashboard]);

  /** Scrolls to the account balances card after a new account is created so the glow is visible. */
  useEffect(() => {
    if (!newlyCreatedAccountId) return;
    const scrollTimer = setTimeout(() => {
      document
        .getElementById("account-balances-anchor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(scrollTimer);
  }, [newlyCreatedAccountId]);

  if (hasLoadFailed) {
    return (
      <ServiceErrorPage
        title="Bloom couldn't load your dashboard"
        description="Your data is safe. This is usually temporary — try again in a moment."
        onRetry={() => window.location.reload()}
        shouldShowHomeLink={false}
      />
    );
  }

  if (!isProfileLoading && !profile) {
    return <ProfileOnboarding onSaved={handleProfileSaved} />;
  }

  const reorderableCards = buildDashboardCards({
    visibleCards,
    accounts: dashboard.accounts,
    budgets: dashboard.budgets,
    monthlySummary: dashboard.monthlySummary,
    previousMonthlySummary: dashboard.previousMonthlySummary,
    monthlyTrends: dashboard.monthlyTrends,
    netWorthHistory: dashboard.netWorthHistory,
    recurringRules: dashboard.recurringRules,
    goals: dashboard.goals,
    manualEntries: dashboard.manualEntries,
    profile,
    rangeQuery,
    isCurrentMonth: dateRange.preset === "this-month",
    newlyCreatedAccountId,
    onChanged: loadDashboard,
  });

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px 48px",
      }}
    >
      <DashboardHeader
        firstName={cachedFirstName}
        highlight={{
          accounts: dashboard.accounts,
          budgets: dashboard.budgets,
          goals: dashboard.goals,
          monthlySummary: dashboard.isLoading ? null : dashboard.monthlySummary,
          previousMonthlySummary: dashboard.previousMonthlySummary,
          recurringRules: dashboard.recurringRules,
          primaryFinancialGoal: profile?.primaryFinancialGoal ?? null,
          budgetHighlightRanking: profile?.budgetHighlightRanking ?? null,
        }}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {dashboard.isLoading ? (
        <DashboardSkeleton
          dashboardColumns={dashboardColumns}
          twoColumnGrid={getTwoColumnGrid(effectiveView)}
        />
      ) : (
        <div className="content-fade-in">
          {/* Onboarding checklist — only visible to new users until all steps complete or dismissed */}
          <OnboardingChecklist
            accounts={dashboard.accounts}
            budgets={dashboard.budgets}
            goals={dashboard.goals}
            monthlySummary={dashboard.monthlySummary}
          />

          {dashboard.accounts.length > 0 && (
            <SummaryStatsRow
              accounts={dashboard.accounts}
              manualEntries={dashboard.manualEntries}
            />
          )}

          {/* Customizable cards — drag any card by its handle to reorder; the order persists per user. */}
          <DraggableCardGrid cards={reorderableCards} columns={dashboardColumns} />

          <ManageAccountsSection
            columns={dashboardColumns}
            onAccountCreated={async (newAccountId) => {
              setNewlyCreatedAccountId(newAccountId);
              await loadDashboard();
            }}
            onBankLinked={loadDashboard}
          />
        </div>
      )}
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
