"use client";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { PayoffChartPoint } from "./debt-payoff-math";

type DebtPayoffChartProps = {
  data: PayoffChartPoint[];
  showUserPayment: boolean;
  showBoosted: boolean;
};

const TOOLTIP_CONTENT_STYLE = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f3f4f6",
};

/** Formats a Y-axis balance tick as a compact dollar amount. */
function formatYAxisTick(value: number): string {
  if (value >= 1000)
    return `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(value)}`;
}

/** Maps a recharts dataKey to a human-readable scenario label. */
function formatScenarioName(key: string): string {
  if (key === "minimum") return "Minimum payment";
  if (key === "userPayment") return "Your payment";
  return "+$50/month";
}

/** Line chart comparing remaining balance over time across all debt payoff scenarios. */
export function DebtPayoffChart({
  data,
  showUserPayment,
  showBoosted,
}: DebtPayoffChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#ffffff08"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v === 0 ? "Now" : `${v}mo`)}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatYAxisTick}
          width={48}
        />
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            formatScenarioName(String(name)),
          ]}
          labelFormatter={(v) => (v === 0 ? "Now" : `Month ${v}`)}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          labelStyle={{ color: "#9ca3af" }}
          cursor={{ stroke: "#ffffff18" }}
        />
        <Legend
          formatter={formatScenarioName}
          wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
        />
        <Line
          dataKey="minimum"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 3"
        />
        {showUserPayment && (
          <Line
            dataKey="userPayment"
            stroke="#38bdf8"
            strokeWidth={2.5}
            dot={false}
          />
        )}
        {showBoosted && (
          <Line
            dataKey="boosted"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
