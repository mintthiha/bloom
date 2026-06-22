"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
import { NetWorthEmpathyNote } from "./NetWorthEmpathyNote";

type Props = {
  history: NetWorthSnapshot[];
};

const TOOLTIP_CONTENT_STYLE = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f3f4f6",
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
      headerRight={headerRight ?? undefined}
      className="fade-up fade-up-2"
      style={{ marginBottom: "32px" }}
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
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
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "netWorth" ? "Net Worth" : name === "totalAssets" ? "Assets" : "Debt",
            ]}
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={{ color: "#9ca3af" }}
            cursor={{ stroke: "#ffffff18" }}
          />
          <ReferenceLine y={0} stroke="#ffffff18" strokeDasharray="4 4" />
          <Line dataKey="totalAssets" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line dataKey="totalDebt" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line
            dataKey="netWorth"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
          />
          <Legend
            formatter={(value) =>
              value === "netWorth" ? "Net Worth" : value === "totalAssets" ? "Assets" : "Debt"
            }
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <NetWorthEmpathyNote history={history} />
    </CollapsibleCard>
  );
}
