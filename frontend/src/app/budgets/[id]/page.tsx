"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, BudgetActivity, DateRangeQuery } from "@/lib/api";
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
import { SavingsGoals } from "./_components/_savingsGoals/SavingsGoals";

export default function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [budget, setBudget] = useState<BudgetActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeState>(() =>
    getPresetDateRange("this-month"),
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
          setError(
            err instanceof Error ? err.message : "Failed to load budget",
          );
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
        <div
          className="skeleton"
          style={{ height: "120px", marginBottom: "20px" }}
        />
        <div
          className="skeleton"
          style={{ height: "280px", marginBottom: "20px" }}
        />
        <div className="skeleton" style={{ height: "320px" }} />
      </div>
    );
  }

  if (error || !budget) {
    return (
      <div
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "40px 24px 48px",
        }}
      >
        <Link
          href="/"
          style={{
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontSize: "13px",
          }}
        >
          ← Back to dashboard
        </Link>
        <div
          style={{
            marginTop: "18px",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "24px",
            background: "var(--surface-1)",
          }}
        >
          <h1
            style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}
          >
            Budget activity unavailable
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {error ?? "Unable to load this budget."}
          </p>
        </div>
      </div>
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

      <SavingsGoals />
    </div>
  );
}
