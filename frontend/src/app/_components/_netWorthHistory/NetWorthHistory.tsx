"use client";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { NetWorthSnapshot } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ChartTooltip } from "@/components/chart-tooltip";
import { NetWorthEmpathyNote } from "./NetWorthEmpathyNote";

type Props = {
  history: NetWorthSnapshot[];
};

const NET_WORTH_NAME_MAP = {
  netWorth: "Net Worth",
  totalAssets: "Assets",
  totalDebt: "Debt",
};

/** Net worth history card showing assets, debt, and net worth over the last 12 months. */
export function NetWorthHistory({ history }: Props) {
  const headerRight = (() => {
    if (history.length < 2) return null;
    const first = history[0]!;
    const last = history[history.length - 1]!;
    const delta = last.netWorth - first.netWorth;
    return (
      <div style={{ textAlign: "right" }}>
        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            marginBottom: "5px",
          }}
        >
          Since {first.month}
        </p>
        <p
          className="num"
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: delta >= 0 ? "#22c55e" : "#ef4444",
          }}
        >
          {delta >= 0 ? "+" : ""}
          {formatCurrency(delta)}
        </p>
      </div>
    );
  })();

  return (
    <CollapsibleCard
      eyebrow="Net Worth History"
      title="Assets vs debt over time"
      description="Watch how your assets and debts shift month over month."
      headerRight={headerRight ?? undefined}
      className="fade-up fade-up-2"
    >
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
            width={56}
          />
          <Tooltip
            content={<ChartTooltip nameMap={NET_WORTH_NAME_MAP} />}
            cursor={{ stroke: "var(--border)" }}
          />
          <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
          <Area
            dataKey="netWorth"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#netWorthFill)"
            dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
          />
          <Line dataKey="totalAssets" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line dataKey="totalDebt" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Legend
            formatter={(value) =>
              value === "netWorth" ? "Net Worth" : value === "totalAssets" ? "Assets" : "Debt"
            }
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <NetWorthEmpathyNote history={history} />
    </CollapsibleCard>
  );
}
