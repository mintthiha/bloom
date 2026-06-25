"use client";
import { useState, useMemo } from "react";
import type { Transaction } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { inputStyle } from "@/lib/styles/input";
import { CARD_PROGRAMS, computePointsByCategory, computeTotalPoints } from "./credit-rewards-math";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

type CreditRewardsPanelProps = {
  txns: Transaction[];
};

const TOOLTIP_CONTENT_STYLE = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

/** Formats a points X-axis tick as a compact number. */
function formatPointsTick(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
}

/** Bar chart panel estimating credit card rewards points by spending category. */
export function CreditRewardsPanel({ txns }: CreditRewardsPanelProps) {
  const accentColor = ACCOUNT_TYPE_META.CREDIT.color;
  const [selectedProgramId, setSelectedProgramId] = useState(CARD_PROGRAMS[0].id);

  const selectedProgram =
    CARD_PROGRAMS.find((program) => program.id === selectedProgramId) ?? CARD_PROGRAMS[0];

  const charges = useMemo(
    () => txns.filter((transaction) => transaction.type === "DEPOSIT"),
    [txns]
  );

  const categoryPoints = useMemo(
    () => computePointsByCategory(charges, selectedProgram),
    [charges, selectedProgram]
  );

  const totalPoints = computeTotalPoints(categoryPoints);
  const totalSpending = charges.reduce((sum, transaction) => sum + transaction.amount, 0);
  const hasData = categoryPoints.length > 0;
  const chartHeight = Math.max(180, categoryPoints.length * 44);

  return (
    <CollapsibleCard
      eyebrow="Credit Card"
      title="Rewards Points Estimator"
      defaultCollapsed={false}
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            htmlFor="rewards-card-program"
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Card Program
          </label>
          <select
            id="rewards-card-program"
            value={selectedProgramId}
            onChange={(event) => setSelectedProgramId(event.target.value)}
            style={inputStyle}
          >
            {CARD_PROGRAMS.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {selectedProgram.description}
          </p>
        </div>

        {!hasData ? (
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            No charges in the current view — add transactions to see estimated points.
          </p>
        ) : (
          <>
            <div>
              <p
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  letterSpacing: "-0.4px",
                  color: accentColor,
                }}
              >
                {totalPoints.toLocaleString()} pts
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                Estimated total · {charges.length} charge{charges.length !== 1 ? "s" : ""} ·{" "}
                {formatCurrency(totalSpending)} spent
              </p>
            </div>

            <div>
              <p
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginBottom: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Points by Category
              </p>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  layout="vertical"
                  data={categoryPoints}
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--chart-grid)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatPointsTick}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                    tickLine={false}
                    axisLine={false}
                    width={96}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={{
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                      marginBottom: "4px",
                    }}
                    formatter={(value, _name, props) => [
                      `${Number(value).toLocaleString()} pts · ${props.payload.multiplier}x · ${formatCurrency(props.payload.spending)}`,
                      "Estimated points",
                    ]}
                  />
                  <Bar dataKey="points" radius={[0, 4, 4, 0]}>
                    {categoryPoints.map((entry, index) => {
                      const isBonus =
                        (selectedProgram.categoryMultipliers[entry.category] ??
                          selectedProgram.basePtsPerDollar) > 1;
                      return (
                        <Cell key={index} fill={accentColor} fillOpacity={isBonus ? 0.85 : 0.35} />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {Object.keys(selectedProgram.categoryMultipliers).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {Object.entries(selectedProgram.categoryMultipliers).map(
                  ([category, multiplier]) => (
                    <div
                      key={category}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: `${accentColor}18`,
                        border: `1px solid ${accentColor}33`,
                        fontSize: "12px",
                        color: accentColor,
                        fontWeight: 600,
                      }}
                    >
                      {multiplier}x {category}
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div
        style={{
          marginTop: "16px",
          paddingTop: "14px",
          borderTop: "1px solid var(--border)",
          fontSize: "12px",
          color: "var(--text-muted)",
        }}
      >
        Estimates are based on categorized charges in the current date range. Actual rewards vary by
        card issuer.
      </div>
    </CollapsibleCard>
  );
}
