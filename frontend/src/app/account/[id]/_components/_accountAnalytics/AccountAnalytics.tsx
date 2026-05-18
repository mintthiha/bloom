import { Transaction, Account } from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/** Formats a number as CAD currency. */
const fmt = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(n);

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
};
const CREDIT_TYPE_LABELS: Record<string, string> = {
  ...TYPE_LABELS,
  DEPOSIT: "Charge",
  WITHDRAWAL: "Payment",
};
const TYPE_COLORS: Record<string, string> = {
  DEPOSIT: "#22c55e",
  WITHDRAWAL: "#f87171",
  TRANSFER_OUT: "#fb923c",
  TRANSFER_IN: "#60a5fa",
};

interface AccountAnalyticsProps {
  txns: Transaction[];
  accountType: Account["accountType"];
  analyticsColumns: string;
  accentColor: string;
}

/** Renders balance history line chart and transaction type donut chart. */
export function AccountAnalytics({
  txns,
  accountType,
  analyticsColumns,
  accentColor,
}: AccountAnalyticsProps) {
  const isCredit = accountType === "CREDIT";
  const typeLabels = isCredit ? CREDIT_TYPE_LABELS : TYPE_LABELS;

  const balanceData = [...txns].reverse().map((t) => ({
    timestamp: t.effectiveAt,
    balance: t.balanceAfter,
  }));

  const typeCounts: Record<string, number> = {};
  for (const t of txns) typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
  const donutData = Object.entries(typeCounts).map(([type, value]) => ({
    name: typeLabels[type] ?? type,
    value,
    color: TYPE_COLORS[type] ?? "#888",
  }));

  return (
    <div
      className="fade-up fade-up-2"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "24px",
        marginBottom: "16px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-secondary)",
          marginBottom: "20px",
        }}
      >
        Analytics
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: analyticsColumns,
          gap: "24px",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginBottom: "12px",
            }}
          >
            Balance History
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart
              data={balanceData}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 10, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                  })
                }
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "#9ca3af" }}
                labelFormatter={(value) =>
                  new Date(value).toLocaleString("en-CA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                }
                formatter={(value) => [fmt(Number(value)), "Balance"]}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke={accentColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: accentColor }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginBottom: "12px",
            }}
          >
            Transaction Types
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={64}
                dataKey="value"
                paddingAngle={3}
              >
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", color: "#6b7280" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
