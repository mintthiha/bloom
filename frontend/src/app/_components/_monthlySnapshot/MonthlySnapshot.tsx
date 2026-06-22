"use client";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { MonthlySummary, MonthlyTrend } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { CollapsibleCard } from "@/components/collapsible-card";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  monthlySummary: MonthlySummary;
  previousMonthlySummary: MonthlySummary | null;
  monthlyTrends: MonthlyTrend[];
  isCurrentMonth: boolean;
};

type SnapshotView = "snapshot" | "trends";

const TOOLTIP_CONTENT_STYLE = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f3f4f6",
};

/** Returns a spending forecast for the current month, or null if not applicable. */
function computeSpendingForecast(
  monthlySummary: MonthlySummary,
  previousMonthlySummary: MonthlySummary | null,
  isCurrentMonth: boolean
) {
  if (!isCurrentMonth) return null;
  const now = new Date();
  const daysElapsed = now.getDate();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (daysElapsed < 2) return null;
  const projected = (monthlySummary.spending / daysElapsed) * totalDays;
  const vsLastMonth = previousMonthlySummary ? projected - previousMonthlySummary.spending : null;
  return { projected, vsLastMonth };
}

/** Monthly cash-flow snapshot card with snapshot/trends toggle and spending forecast. */
export function MonthlySnapshot({
  monthlySummary,
  previousMonthlySummary,
  monthlyTrends,
  isCurrentMonth,
}: Props) {
  const [snapshotView, setSnapshotView] = useState<SnapshotView>("snapshot");
  const isMobile = useIsMobile();

  const incomeDelta =
    previousMonthlySummary != null ? monthlySummary.income - previousMonthlySummary.income : null;
  const spendingDelta =
    previousMonthlySummary != null
      ? monthlySummary.spending - previousMonthlySummary.spending
      : null;
  const netDelta =
    previousMonthlySummary != null
      ? monthlySummary.netCashFlow - previousMonthlySummary.netCashFlow
      : null;

  const expenseCategories = monthlySummary.categories.filter((category) => category.spending > 0);

  const savingsRate =
    monthlySummary.income > 0 ? monthlySummary.netCashFlow / monthlySummary.income : null;
  const savingsRateColor =
    savingsRate === null
      ? "var(--text-muted)"
      : savingsRate >= 0.2
        ? "#22c55e"
        : savingsRate >= 0.1
          ? "#f59e0b"
          : "#f87171";
  const savingsRateTooltip =
    savingsRate !== null
      ? `Saving ${Math.round(savingsRate * 100)}% of your income. Most financial plans suggest 20% as a starting target.`
      : "No income recorded this month.";

  const spendingForecast = computeSpendingForecast(
    monthlySummary,
    previousMonthlySummary,
    isCurrentMonth
  );

  const headerRight = (
    <div
      style={{
        display: "flex",
        gap: "6px",
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      {!isMobile && snapshotView === "snapshot" && monthlySummary.topExpenseCategory && (
        <div style={{ textAlign: "right", marginRight: "8px" }}>
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
            Top Spend
          </p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b" }}>
            {monthlySummary.topExpenseCategory}
          </p>
        </div>
      )}
      {(["snapshot", "trends"] as const).map((viewOption) => (
        <button
          key={viewOption}
          type="button"
          onClick={() => setSnapshotView(viewOption)}
          style={{
            padding: "5px 12px",
            borderRadius: "8px",
            border: snapshotView === viewOption ? "1px solid #f59e0b66" : "1px solid var(--border)",
            background: snapshotView === viewOption ? "#f59e0b1a" : "var(--surface-2)",
            color: snapshotView === viewOption ? "#f59e0b" : "var(--text-secondary)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            textTransform: "capitalize",
          }}
        >
          {viewOption === "snapshot" ? "Snapshot" : "Trends"}
        </button>
      ))}
    </div>
  );

  return (
    <CollapsibleCard
      eyebrow="Monthly Snapshot"
      title={snapshotView === "snapshot" ? "Cash flow by category" : "Last 6 months"}
      headerRight={headerRight}
      className="fade-up fade-up-1"
      style={{
        background: "linear-gradient(135deg, #17120a 0%, var(--surface-1) 58%)",
      }}
    >
      {snapshotView === "snapshot" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
              marginBottom: expenseCategories.length ? "22px" : "0",
            }}
          >
            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Income
              </p>
              <p className="num" style={{ fontSize: "18px", fontWeight: 600, color: "#22c55e" }}>
                {formatCurrency(monthlySummary.income)}
              </p>
              {incomeDelta !== null && incomeDelta !== 0 && (
                <p
                  className="num"
                  style={{
                    fontSize: "11px",
                    marginTop: "5px",
                    color: incomeDelta > 0 ? "#22c55e" : "#f97316",
                  }}
                >
                  {incomeDelta > 0 ? "+" : ""}
                  {formatCurrency(incomeDelta)} vs prior
                </p>
              )}
            </div>

            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Spending
              </p>
              <p className="num" style={{ fontSize: "18px", fontWeight: 600, color: "#f97316" }}>
                {formatCurrency(monthlySummary.spending)}
              </p>
              {spendingDelta !== null && spendingDelta !== 0 && (
                <p
                  className="num"
                  style={{
                    fontSize: "11px",
                    marginTop: "5px",
                    color: spendingDelta < 0 ? "#22c55e" : "#f97316",
                  }}
                >
                  {spendingDelta > 0 ? "+" : ""}
                  {formatCurrency(spendingDelta)} vs prior
                </p>
              )}
            </div>

            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Net
              </p>
              <p
                className="num"
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: monthlySummary.netCashFlow >= 0 ? "#22c55e" : "#f97316",
                }}
              >
                {formatCurrency(monthlySummary.netCashFlow)}
              </p>
              {netDelta !== null && netDelta !== 0 && (
                <p
                  className="num"
                  style={{
                    fontSize: "11px",
                    marginTop: "5px",
                    color: netDelta > 0 ? "#22c55e" : "#f97316",
                  }}
                >
                  {netDelta > 0 ? "+" : ""}
                  {formatCurrency(netDelta)} vs prior
                </p>
              )}
            </div>

            <div
              title={savingsRateTooltip}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "14px",
                cursor: "default",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Savings Rate
              </p>
              <p
                className="num"
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: savingsRateColor,
                }}
              >
                {savingsRate !== null ? `${Math.round(savingsRate * 100)}%` : "N/A"}
              </p>
            </div>
          </div>

          {spendingForecast && (
            <div
              style={{
                margin: "14px 0",
                padding: "10px 14px",
                borderRadius: "10px",
                background:
                  spendingForecast.vsLastMonth !== null && spendingForecast.vsLastMonth > 0
                    ? "#f9731608"
                    : "#22c55e08",
                border: `1px solid ${
                  spendingForecast.vsLastMonth !== null && spendingForecast.vsLastMonth > 0
                    ? "#f9731622"
                    : "#22c55e22"
                }`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background:
                      spendingForecast.vsLastMonth !== null && spendingForecast.vsLastMonth > 0
                        ? "#f97316"
                        : "#22c55e",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  On track to spend{" "}
                  <span className="num" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                    {formatCurrency(spendingForecast.projected)}
                  </span>{" "}
                  by end of month
                </span>
              </div>
              {spendingForecast.vsLastMonth !== null && (
                <span
                  className="num"
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: spendingForecast.vsLastMonth > 0 ? "#f97316" : "#22c55e",
                    flexShrink: 0,
                  }}
                >
                  {spendingForecast.vsLastMonth > 0 ? "+" : ""}
                  {formatCurrency(spendingForecast.vsLastMonth)} vs last month
                </span>
              )}
            </div>
          )}

          {expenseCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={expenseCategories} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={48}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={{ color: "#f59e0b" }}
                  itemStyle={{ color: "#f3f4f6" }}
                  cursor={{ fill: "#ffffff06" }}
                />
                <Bar dataKey="spending" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              No spending has been categorized this month yet.
            </p>
          )}
        </>
      ) : monthlyTrends.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyTrends} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                name === "income" ? "Income" : name === "spending" ? "Spending" : "Net",
              ]}
              contentStyle={TOOLTIP_CONTENT_STYLE}
              labelStyle={{ color: "#9ca3af" }}
              cursor={{ fill: "#ffffff06" }}
            />
            <Legend
              formatter={(value) =>
                value === "income" ? "Income" : value === "spending" ? "Spending" : "Net"
              }
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
            <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="spending" fill="#f97316" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>No transaction history yet.</p>
      )}
    </CollapsibleCard>
  );
}
