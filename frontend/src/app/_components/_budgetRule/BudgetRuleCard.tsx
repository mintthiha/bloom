"use client";
import { useMemo } from "react";
import { MonthlySummary } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { formatCurrency } from "@/lib/format";

const NEEDS_CATEGORIES = new Set([
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Healthcare",
]);

const NEEDS_TARGET_PCT = 50;
const WANTS_TARGET_PCT = 30;
const SAVINGS_TARGET_PCT = 20;

type BucketRowProps = {
  label: string;
  sublabel: string;
  amount: number;
  pct: number;
  targetPct: number;
  color: string;
  insightText: string;
};

/** Returns a color for a bucket bar based on distance from target. */
function getBucketColor(
  pct: number,
  targetPct: number,
  higherIsBetter: boolean
): string {
  if (higherIsBetter) {
    if (pct >= targetPct) return "#22c55e";
    if (pct >= targetPct * 0.5) return "#f59e0b";
    return "#f87171";
  }
  if (pct <= targetPct) return "#22c55e";
  if (pct <= targetPct * 1.2) return "#f59e0b";
  return "#f87171";
}

/** A single 50/30/20 bucket row with a labeled progress bar and target marker. */
function BucketRow({
  label,
  sublabel,
  amount,
  pct,
  targetPct,
  color,
  insightText,
}: BucketRowProps) {
  const barWidth = Math.min(Math.max(pct, 0), 100);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {sublabel}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "baseline",
            flexShrink: 0,
          }}
        >
          <span
            className="num"
            style={{ fontSize: "14px", fontWeight: 700, color }}
          >
            {pct.toFixed(0)}%
          </span>
          <span
            className="num"
            style={{ fontSize: "12px", color: "var(--text-secondary)" }}
          >
            {formatCurrency(amount)}
          </span>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          height: "8px",
          background: "var(--surface-2)",
          borderRadius: "4px",
          marginBottom: "6px",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${barWidth}%`,
            background: color,
            borderRadius: "4px",
            transition: "width 0.5s ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${targetPct}%`,
            top: "-3px",
            height: "14px",
            width: "2px",
            background: "var(--text-muted)",
            borderRadius: "1px",
            transform: "translateX(-50%)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
          {insightText}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          target {targetPct}%
        </span>
      </div>
    </div>
  );
}

/** Collapsible card visualizing how the user's spending maps to the 50/30/20 budgeting rule. */
export function BudgetRuleCard({
  monthlySummary,
}: {
  monthlySummary: MonthlySummary;
}) {
  const { income, spending, netCashFlow, categories } = monthlySummary;

  const needsAmount = useMemo(
    () =>
      categories
        .filter((c) => NEEDS_CATEGORIES.has(c.category) && c.spending > 0)
        .reduce((sum, c) => sum + c.spending, 0),
    [categories]
  );

  const wantsAmount = Math.max(spending - needsAmount, 0);
  const savingsAmount = netCashFlow;

  const needsPct = income > 0 ? (needsAmount / income) * 100 : 0;
  const wantsPct = income > 0 ? (wantsAmount / income) * 100 : 0;
  const savingsPct = income > 0 ? (savingsAmount / income) * 100 : 0;

  const largestNeed = useMemo(
    () =>
      categories
        .filter((c) => NEEDS_CATEGORIES.has(c.category) && c.spending > 0)
        .sort((a, b) => b.spending - a.spending)[0] ?? null,
    [categories]
  );

  const largestWant = useMemo(
    () =>
      categories
        .filter((c) => !NEEDS_CATEGORIES.has(c.category) && c.spending > 0)
        .sort((a, b) => b.spending - a.spending)[0] ?? null,
    [categories]
  );

  const needsColor = getBucketColor(needsPct, NEEDS_TARGET_PCT, false);
  const wantsColor = getBucketColor(wantsPct, WANTS_TARGET_PCT, false);
  const savingsColor = getBucketColor(savingsPct, SAVINGS_TARGET_PCT, true);

  return (
    <CollapsibleCard
      eyebrow="50 / 30 / 20"
      title="Budget Rule"
      description="How your spending maps to the 50/30/20 framework."
      className="fade-up fade-up-1"
      style={{}}
    >
      {income === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          No income recorded this month.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <BucketRow
            label="Needs"
            sublabel="Groceries · Rent · Utilities · Transport · Healthcare"
            amount={needsAmount}
            pct={needsPct}
            targetPct={NEEDS_TARGET_PCT}
            color={needsColor}
            insightText={
              largestNeed
                ? `Largest: ${largestNeed.category} (${formatCurrency(largestNeed.spending)})`
                : "No needs spending recorded this month."
            }
          />
          <BucketRow
            label="Wants"
            sublabel="Dining · Shopping · Entertainment & more"
            amount={wantsAmount}
            pct={wantsPct}
            targetPct={WANTS_TARGET_PCT}
            color={wantsColor}
            insightText={
              largestWant
                ? `Largest: ${largestWant.category} (${formatCurrency(largestWant.spending)})`
                : "No wants spending recorded this month."
            }
          />
          <BucketRow
            label="Savings"
            sublabel="Income minus all spending"
            amount={savingsAmount}
            pct={savingsPct}
            targetPct={SAVINGS_TARGET_PCT}
            color={savingsColor}
            insightText={
              savingsPct >= SAVINGS_TARGET_PCT
                ? "At or above the 20% savings target."
                : savingsPct > 0
                ? `${(SAVINGS_TARGET_PCT - savingsPct).toFixed(0)}% short of the 20% target.`
                : "Spending exceeds income this month."
            }
          />
        </div>
      )}
    </CollapsibleCard>
  );
}
