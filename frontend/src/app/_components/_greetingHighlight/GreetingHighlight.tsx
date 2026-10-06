"use client";
import { useMemo } from "react";
import {
  Account,
  Budget,
  MonthlySummary,
  PrimaryFinancialGoal,
  RecurringTransaction,
  SavingsGoal,
} from "@/lib/api";
import { GreetingHighlightTone, selectGreetingHighlight } from "./greeting-highlight";

type Props = {
  accounts: Account[];
  budgets: Budget[];
  goals: SavingsGoal[];
  monthlySummary: MonthlySummary | null;
  previousMonthlySummary: MonthlySummary | null;
  recurringRules: RecurringTransaction[];
  primaryFinancialGoal: PrimaryFinancialGoal | null;
};

const TONE_COLOR: Record<GreetingHighlightTone, string> = {
  positive: "#22c55e",
  warning: "#f87171",
  neutral: "#f59e0b",
};

/** Shown while data is still loading, or when the user has too little data for a specific line. */
const FALLBACK_TEXT = "Here's your financial overview.";

/**
 * The hero sub-line under the dashboard greeting: one concrete fact drawn from the user's own data
 * and ranked by their primary financial goal, falling back to the generic overview copy.
 */
export function GreetingHighlight({
  accounts,
  budgets,
  goals,
  monthlySummary,
  previousMonthlySummary,
  recurringRules,
  primaryFinancialGoal,
}: Props) {
  const highlight = useMemo(
    () =>
      selectGreetingHighlight({
        accounts,
        budgets,
        goals,
        monthlySummary,
        previousMonthlySummary,
        recurringRules,
        primaryFinancialGoal,
      }),
    [
      accounts,
      budgets,
      goals,
      monthlySummary,
      previousMonthlySummary,
      recurringRules,
      primaryFinancialGoal,
    ]
  );

  if (!highlight) {
    return <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>{FALLBACK_TEXT}</p>;
  }

  return (
    <p
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "var(--text-primary)",
        fontSize: "15px",
        fontWeight: 500,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "999px",
          background: TONE_COLOR[highlight.tone],
          flexShrink: 0,
        }}
      />
      {highlight.text}
    </p>
  );
}
