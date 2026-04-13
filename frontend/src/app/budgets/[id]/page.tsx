"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, BudgetActivity, DateRangeQuery } from "@/lib/api";
import { DateRangeControls } from "@/components/date-range-controls";
import { buildDateRangeQuery, DateRangeState, getBrowserTimeZone, getPresetDateRange } from "@/lib/date-range";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [budget, setBudget] = useState<BudgetActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeState>(() => getPresetDateRange("this-month"));
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

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);

  const dailyChartData = useMemo(
    () =>
      budget?.dailySpending.map((entry) => ({
        label: new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(new Date(entry.day)),
        total: entry.total,
      })) ?? [],
    [budget]
  );

  if (loading) {
    return (
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 48px" }}>
        <div className="skeleton" style={{ height: "120px", marginBottom: "20px" }} />
        <div className="skeleton" style={{ height: "280px", marginBottom: "20px" }} />
        <div className="skeleton" style={{ height: "320px" }} />
      </div>
    );
  }

  if (error || !budget) {
    return (
      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "40px 24px 48px" }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "13px" }}>
          ← Back to dashboard
        </Link>
        <div style={{ marginTop: "18px", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px", background: "var(--surface-1)" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>Budget activity unavailable</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{error ?? "Unable to load this budget."}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 24px 48px" }}>
      <div className="fade-up" style={{ marginBottom: "28px" }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "13px" }}>
          ← Back to dashboard
        </Link>
        <div style={{ marginTop: "18px", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f59e0b", marginBottom: "10px" }}>
              Budget Detail
            </p>
            <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "6px" }}>
              {budget.category}
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
              Spending activity for {budget.month}.
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "6px" }}>
              Times shown in {timeZone}.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{budget.activity.length} transaction{budget.activity.length !== 1 ? "s" : ""}</span>
            <DateRangeControls value={dateRange} onChange={setDateRange} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "8px" }}>Limit</p>
          <p className="num" style={{ fontSize: "18px", fontWeight: 600 }}>{fmt(budget.monthlyLimit)}</p>
        </div>
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "8px" }}>Spent</p>
          <p className="num" style={{ fontSize: "18px", fontWeight: 600, color: "#f97316" }}>{fmt(budget.currentSpending)}</p>
        </div>
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "8px" }}>Remaining</p>
          <p className="num" style={{ fontSize: "18px", fontWeight: 600, color: budget.isOverBudget ? "#ef4444" : "#22c55e" }}>
            {budget.isOverBudget ? `-${fmt(Math.abs(budget.remaining))}` : fmt(budget.remaining)}
          </p>
        </div>
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "8px" }}>Usage</p>
          <p className="num" style={{ fontSize: "18px", fontWeight: 600 }}>{budget.percentageUsed.toFixed(0)}%</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 0.95fr)", gap: "20px", alignItems: "start", marginBottom: "28px" }}>
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)", marginBottom: "16px" }}>
            Daily Spending
          </p>
          {dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} width={48} />
                <Tooltip
                  formatter={(value) => fmt(Number(value))}
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "8px", fontSize: "12px", color: "#f3f4f6" }}
                  labelStyle={{ color: "#f59e0b" }}
                  itemStyle={{ color: "#f3f4f6" }}
                  cursor={{ fill: "#ffffff06" }}
                />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No spending has been recorded for this category this month.</p>
          )}
        </div>

        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)", marginBottom: "16px" }}>
            By Account
          </p>
          {budget.accountTotals.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {budget.accountTotals.map((account, index) => (
                <div key={account.accountId}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{account.accountName}</span>
                    <span className="num" style={{ fontSize: "13px", color: "#f59e0b" }}>{fmt(account.total)}</span>
                  </div>
                  <div style={{ height: "8px", borderRadius: "999px", background: "#ffffff0a", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${budget.currentSpending > 0 ? (account.total / budget.currentSpending) * 100 : 0}%`,
                        height: "100%",
                        background: index % 2 === 0 ? "#f59e0b" : "#22c55e",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No account activity to break down yet.</p>
          )}
        </div>
      </div>

      <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", marginBottom: "16px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
            Transactions
          </p>
          <span className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>{budget.activity.length}</span>
        </div>

        {budget.activity.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No matching withdrawals for this category this month.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {budget.activity.map((transaction) => (
              <div
                key={transaction.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px minmax(0, 1fr) 160px 120px",
                  gap: "12px",
                  alignItems: "center",
                  padding: "14px 16px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                }}
              >
                <div>
                  <p className="num" style={{ fontSize: "12px", fontWeight: 600 }}>
                    {new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(new Date(transaction.effectiveAt))}
                  </p>
                  <p className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit" }).format(new Date(transaction.effectiveAt))}
                  </p>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {transaction.description || transaction.category || "Withdrawal"}
                  </p>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {transaction.accountName}
                  </p>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {transaction.description ? "Custom note" : "Categorized expense"}
                </div>
                <div className="num" style={{ textAlign: "right", fontSize: "14px", fontWeight: 600, color: "#f97316" }}>
                  {fmt(transaction.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
