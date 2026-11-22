"use client";
import { useMemo } from "react";
import { CircleCheck } from "lucide-react";
import {
  Account,
  Budget,
  MonthlySummary,
  Profile,
  RecurringTransaction,
  SavingsGoal,
} from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { EmptyState } from "@/components/EmptyState";
import { generateInsights, InsightItem, InsightSeverity } from "./insights";
import { buildMoneyLadder } from "./money-ladder";
import { MoneyLadderSection } from "./MoneyLadderSection";

type Props = {
  accounts: Account[];
  budgets: Budget[];
  monthlySummary: MonthlySummary;
  previousMonthlySummary: MonthlySummary | null;
  recurringRules: RecurringTransaction[];
  profile: Profile | null;
  goals: SavingsGoal[];
};

const SEVERITY_ACCENT_COLOR: Record<InsightSeverity, string> = {
  warning: "var(--negative-soft)",
  info: "#3b82f6",
  success: "var(--positive)",
};

/** A single insight row: a severity-tinted panel with a coloured index number, message, and detail. */
function InsightRow({ item, index }: { item: InsightItem; index: number }) {
  const color = SEVERITY_ACCENT_COLOR[item.severity];

  return (
    <div
      style={{
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
        background: `color-mix(in srgb, ${color} 5%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        borderRadius: "10px",
        padding: "12px 14px",
      }}
    >
      <span
        className="num"
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: color,
          flexShrink: 0,
          paddingTop: "1px",
        }}
      >
        {index + 1}
      </span>
      <div>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "3px",
            color: "var(--text-primary)",
          }}
        >
          {item.message}
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{item.detail}</p>
      </div>
    </div>
  );
}

/**
 * "Your Next Moves" card: the money ladder (where the next dollar should go) on top, then up to
 * 3 action items for this month (budgets, overdue bills, savings rate).
 */
export function InsightsCard({
  accounts,
  budgets,
  monthlySummary,
  previousMonthlySummary,
  recurringRules,
  profile,
  goals,
}: Props) {
  const ladder = useMemo(
    () =>
      buildMoneyLadder({
        accounts,
        monthlySummary,
        previousMonthlySummary,
        profile,
        goals,
        currentYear: new Date().getFullYear(),
      }),
    [accounts, monthlySummary, previousMonthlySummary, profile, goals]
  );

  const insights = useMemo(
    () => generateInsights({ budgets, monthlySummary, recurringRules }),
    [budgets, monthlySummary, recurringRules]
  );

  const warningCount = insights.filter((i) => i.severity === "warning").length;

  const headerRight =
    warningCount > 0 ? (
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          padding: "3px 9px",
          borderRadius: "999px",
          background: "#f8717122",
          color: "var(--negative-soft)",
        }}
      >
        {warningCount} action{warningCount !== 1 ? "s" : ""}
      </span>
    ) : null;

  return (
    <CollapsibleCard
      eyebrow="Your Next Moves"
      title="What to focus on next"
      description="Where your next dollar should go, plus anything that needs attention this month."
      headerRight={headerRight}
      className="fade-up fade-up-2"
      style={{}}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <MoneyLadderSection ladder={ladder} />

        <section aria-label="This month">
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}
          >
            This month
          </p>
          {insights.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              variant="inline"
              title="All clear"
              description="No budget, bill, or savings-rate issues this month."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {insights.map((item, index) => (
                <InsightRow key={item.id} item={item} index={index} />
              ))}
            </div>
          )}
        </section>
      </div>
    </CollapsibleCard>
  );
}
