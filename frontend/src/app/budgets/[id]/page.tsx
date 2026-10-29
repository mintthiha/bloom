"use client";

import { use, useEffect, useMemo, useState } from "react";
import { api, BudgetActivity, DateRangeQuery } from "@/lib/api";
import { ServiceErrorPage } from "@/components/ServiceErrorPage";
import { formatCurrency } from "@/lib/format";
import {
  buildDateRangeQuery,
  DateRangeState,
  getBrowserTimeZone,
  getPresetDateRange,
} from "@/lib/date-range";

import { NumCards } from "./_components/_budgetNumCards/NumCards";
import { HeaderSection } from "./_components/_headerSection/HeaderSection";
import { DailySpendingChart } from "./_components/_content/_dailySpendingChart/DailySpendingChart";
import { SpendingPerAccountChart } from "./_components/_content/_spendingPerAccountChart/SpendingPerAccountChart";
import { TransactionsSummary } from "./_components/_content/_transactionsSummary/TransactionsSummary";

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [budget, setBudget] = useState<BudgetActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeState>(() =>
    getPresetDateRange("this-month")
  );
  const [timeZone, setTimeZone] = useState("UTC");

  const rangeQuery: DateRangeQuery | undefined = useMemo(() => {
    return buildDateRangeQuery(dateRange);
  }, [dateRange]);

  useEffect(() => {
    if (dateRange.preset !== "custom") {
      setDateRange(getPresetDateRange(dateRange.preset));
    }
  }, [dateRange.preset]);

  useEffect(() => {
    setTimeZone(getBrowserTimeZone());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBudget() {
      try {
        const nextBudget = await api.getBudgetActivity(id, rangeQuery);
        if (!cancelled) {
          setBudget(nextBudget);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load budget");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBudget();
    return () => {
      cancelled = true;
    };
  }, [id, rangeQuery]);

  if (loading) {
    return (
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 24px 48px",
        }}
      >
        <div className="skeleton" style={{ height: "120px", marginBottom: "20px" }} />
        <div className="skeleton" style={{ height: "280px", marginBottom: "20px" }} />
        <div className="skeleton" style={{ height: "320px" }} />
      </div>
    );
  }

  if (error || !budget) {
    return (
      <ServiceErrorPage
        title="Couldn't load this budget"
        description={error ?? "Unable to load this budget."}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px 48px",
      }}
    >
      <HeaderSection
        budget={budget}
        dateRange={dateRange}
        setDateRange={setDateRange}
        timeZone={timeZone}
      />

      <NumCards budget={budget} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 0.95fr)",
          gap: "20px",
          alignItems: "start",
          marginBottom: "28px",
        }}
      >
        <DailySpendingChart budget={budget} />
        <SpendingPerAccountChart budget={budget} />
      </div>

      <TransactionsSummary budget={budget} />
    </div>
  );
}
