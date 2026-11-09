import type { MonthlyReview } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { formatMonthName } from "../review-month";
import { describeSavingsRate, describeSpendingChange } from "./review-copy";
import { ReviewSection, STAT_TILE_GRID_STYLE, StatTile } from "./ReviewSection";

/** Step 1: money in, money out, what was left over, and how spending compares with last month. */
export function CashFlowStep({ review }: { review: MonthlyReview }) {
  const { cashFlow, biggestExpense } = review;
  const monthName = formatMonthName(review.month);
  const spendingChange = describeSpendingChange(
    cashFlow.spendingChangePercent,
    formatMonthName(review.previousMonth)
  );

  return (
    <ReviewSection
      eyebrow="The numbers"
      title={`How ${monthName} went`}
      description={describeSavingsRate(cashFlow.savingsRate)}
    >
      <div style={STAT_TILE_GRID_STYLE}>
        <StatTile label="Money in" value={formatCurrency(cashFlow.income)} />
        <StatTile
          label="Money out"
          value={formatCurrency(cashFlow.spending)}
          detail={spendingChange}
        />
        <StatTile
          label={cashFlow.netCashFlow >= 0 ? "Left over" : "Overspent"}
          value={formatCurrency(Math.abs(cashFlow.netCashFlow))}
        />
      </div>
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          fontSize: "13px",
          color: "var(--text-secondary)",
          listStyle: "none",
        }}
      >
        <li>
          {cashFlow.transactionCount} transaction{cashFlow.transactionCount === 1 ? "" : "s"}{" "}
          recorded
        </li>
        {biggestExpense && (
          <li>
            Biggest purchase:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{biggestExpense.label}</strong>{" "}
            <span className="num">{formatCurrency(biggestExpense.amount)}</span>
          </li>
        )}
      </ul>
    </ReviewSection>
  );
}
