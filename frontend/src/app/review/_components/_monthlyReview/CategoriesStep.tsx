import type { MonthlyReview } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { formatMonthName } from "../review-month";
import { describeSpendingChange, formatPercent } from "./review-copy";
import { ReviewSection } from "./ReviewSection";

/** Step 2: the biggest spending categories, each with its share of spending and change vs last month. */
export function CategoriesStep({ review }: { review: MonthlyReview }) {
  const [biggest] = review.topCategories;
  const previousMonthName = formatMonthName(review.previousMonth);

  return (
    <ReviewSection
      eyebrow="Where it went"
      title={biggest ? `${biggest.category} was your biggest category` : "Where your money went"}
      description={
        biggest
          ? `${formatPercent(biggest.shareOfSpending)} of everything you spent in ${formatMonthName(review.month)}.`
          : undefined
      }
    >
      <ol style={{ display: "flex", flexDirection: "column", gap: "14px", listStyle: "none" }}>
        {review.topCategories.map((category) => {
          const change = describeSpendingChange(category.changePercent, previousMonthName);
          return (
            <li
              key={category.category}
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  fontSize: "13px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontWeight: 600 }}>{category.category}</span>
                <span className="num" style={{ fontWeight: 700 }}>
                  {formatCurrency(category.spending)}
                </span>
              </div>
              <div
                role="meter"
                aria-label={`${category.category} share of spending`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(category.shareOfSpending * 100)}
                style={{
                  height: "6px",
                  borderRadius: "999px",
                  background: "var(--surface-2)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(category.shareOfSpending * 100, 2)}%`,
                    height: "100%",
                    borderRadius: "999px",
                    background: "var(--brand-accent)",
                  }}
                />
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {formatPercent(category.shareOfSpending)} of spending
                {change ? ` · ${change}` : ` · nothing in ${previousMonthName}`}
              </span>
            </li>
          );
        })}
      </ol>
    </ReviewSection>
  );
}
