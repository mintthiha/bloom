"use client";

import { BudgetActivity } from "@/lib/api";
import { useMemo } from "react";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/chart-tooltip";

type DailySpendingChartProps = { budget: BudgetActivity };

export function DailySpendingChart({ budget }: DailySpendingChartProps) {
  const dailyChartData = useMemo(
    () =>
      budget.dailySpending.map((entry) => ({
        label: new Intl.DateTimeFormat("en-CA", {
          month: "short",
          day: "numeric",
        }).format(new Date(entry.day)),
        total: entry.total,
      })) ?? [],
    [budget]
  );

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-secondary)",
          marginBottom: "16px",
        }}
      >
        Daily Spending
      </p>
      {dailyChartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dailyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
              width={48}
            />
            <Tooltip
              content={<ChartTooltip nameMap={{ total: "Spent" }} />}
              cursor={{ fill: "var(--chart-cursor)" }}
            />
            <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          No spending has been recorded for this category this month.
        </p>
      )}
    </div>
  );
}
