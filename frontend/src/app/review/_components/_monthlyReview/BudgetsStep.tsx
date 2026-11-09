import type { MonthlyReview } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { BudgetRolloverToggle } from "@/components/BudgetRolloverToggle";
import { formatMonthName } from "../review-month";
import { describeBudgetResults, describeCarryOut } from "./review-copy";
import { NextMonthLimitEditor } from "./NextMonthLimitEditor";
import { ReviewSection } from "./ReviewSection";

type BudgetsStepProps = {
  review: MonthlyReview;
  /** Reloads the review after a rollover or limit change so carry-outs and limits stay accurate. */
  onReviewChanged: () => Promise<void>;
};

/**
 * Step 3: how each envelope did, and the two decisions for next month — keep the leftover
 * (rollover) and how much to give it.
 */
export function BudgetsStep({ review, onReviewChanged }: BudgetsStepProps) {
  const nextMonthName = formatMonthName(review.nextMonth);

  return (
    <ReviewSection
      eyebrow="Budgets"
      title={describeBudgetResults(review.budgetResults) ?? "Your budgets"}
      description={`Confirm what carries into ${nextMonthName} and adjust any limits. Changes apply to ${nextMonthName} only.`}
    >
      <ul style={{ display: "flex", flexDirection: "column", gap: "10px", listStyle: "none" }}>
        {review.budgets.map((budget) => (
          <li
            key={budget.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "14px 16px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 }}>
                {budget.category}
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    color: budget.isOverBudget ? "var(--negative-soft)" : "var(--positive)",
                    border: `1px solid ${budget.isOverBudget ? "var(--negative-soft)" : "var(--positive)"}`,
                  }}
                >
                  {budget.isOverBudget ? "Over" : "Kept"}
                </span>
              </span>
              <span className="num" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                {formatCurrency(budget.spent)} of {formatCurrency(budget.available)}
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {describeCarryOut(budget, nextMonthName, (amount) => formatCurrency(amount))}
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <BudgetRolloverToggle budget={budget} onChanged={onReviewChanged} />
              <NextMonthLimitEditor
                budgetId={budget.id}
                category={budget.category}
                nextMonth={review.nextMonth}
                nextMonthName={nextMonthName}
                nextMonthLimit={budget.nextMonthLimit}
                onSaved={onReviewChanged}
              />
            </div>
          </li>
        ))}
      </ul>
    </ReviewSection>
  );
}
