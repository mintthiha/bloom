"use client";
import { useMemo } from "react";
import { CircleCheck } from "lucide-react";
import { Account, Budget, MonthlySummary, RecurringTransaction } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { EmptyState } from "@/components/EmptyState";
import { generateInsights, InsightItem, InsightSeverity } from "./insights";

type Props = {
  accounts: Account[];
  budgets: Budget[];
  monthlySummary: MonthlySummary;
  previousMonthlySummary: MonthlySummary | null;
  recurringRules: RecurringTransaction[];
};

const SEVERITY_ACCENT_COLOR: Record<InsightSeverity, string> = {
  warning: "#f87171",
  info: "#3b82f6",
  success: "#22c55e",
};

/** A single insight row with a colored left accent, index number, message, and supporting detail. */
function InsightRow({ item, index }: { item: InsightItem; index: number }) {
  const color = SEVERITY_ACCENT_COLOR[item.severity];

  return (
    <div
      style={{
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
        background: `${color}0d`,
        borderTop: `1px solid ${color}33`,
        borderRight: `1px solid ${color}33`,
        borderBottom: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
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

/** Collapsible card showing up to 3 prioritized financial action items derived from dashboard data. */
export function InsightsCard({
  accounts,
  budgets,
  monthlySummary,
  previousMonthlySummary,
  recurringRules,
}: Props) {
  const insights = useMemo(
    () =>
      generateInsights({
        accounts,
        budgets,
        monthlySummary,
        previousMonthlySummary,
        recurringRules,
      }),
    [accounts, budgets, monthlySummary, previousMonthlySummary, recurringRules]
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
          color: "#f87171",
        }}
      >
        {warningCount} action{warningCount !== 1 ? "s" : ""}
      </span>
    ) : null;

  return (
    <CollapsibleCard
      eyebrow="Your Next Moves"
      title="What to focus on next"
      description="Personalized action items based on your current data."
      headerRight={headerRight}
      className="fade-up fade-up-2"
      style={{}}
    >
      {insights.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          variant="inline"
          title="All clear"
          description="No action items right now — your accounts are looking healthy."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {insights.map((item, index) => (
            <InsightRow key={item.id} item={item} index={index} />
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}
