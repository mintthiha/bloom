import type { MonthlyReview } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { formatMonthName } from "../review-month";
import { describeGoalProgress, formatPercent } from "./review-copy";
import { ReviewSection } from "./ReviewSection";

/** Step 4: how much each savings goal grew during the month and where it ended up. */
export function GoalsStep({ review }: { review: MonthlyReview }) {
  const totalContributed = review.goals.reduce(
    (sum, goal) => sum + Math.max(goal.contributed, 0),
    0
  );

  return (
    <ReviewSection
      eyebrow="Goals"
      title={
        totalContributed > 0
          ? `You put ${formatCurrency(totalContributed)} toward your goals`
          : "Your goals"
      }
      description={`Balances at the end of ${formatMonthName(review.month)}.`}
    >
      <ul style={{ display: "flex", flexDirection: "column", gap: "14px", listStyle: "none" }}>
        {review.goals.map((goal) => (
          <li key={goal.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                fontSize: "13px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 600 }}>{goal.name}</span>
              <span className="num" style={{ color: "var(--text-secondary)" }}>
                {formatCurrency(goal.balanceAtEnd)} of {formatCurrency(goal.targetAmount)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${goal.name} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(goal.percentAtEnd * 100)}
              style={{
                height: "6px",
                borderRadius: "999px",
                background: "var(--surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${goal.percentAtEnd * 100}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background: goal.isReached ? "var(--positive)" : "var(--brand-accent)",
                }}
              />
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {formatPercent(goal.percentAtEnd)} there ·{" "}
              {describeGoalProgress(goal, (amount) => formatCurrency(amount))}
            </span>
          </li>
        ))}
      </ul>
    </ReviewSection>
  );
}
