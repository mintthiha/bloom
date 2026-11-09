// Pure content for the "<year> in Bloom" recap: the highlight cards and the plain-text version the
// user can copy to share. Missing data simply drops its highlight instead of showing a zero.
import type { YearInReview } from "@/lib/api";
import { formatMonthName } from "../../../_components/review-month";

/** One standout fact in the recap. */
export type RecapHighlight = { id: string; label: string; value: string; detail?: string };

/**
 * Compact dollar labels for the chart's y-axis: "$500", "$1.5k", "$2k". One decimal is kept below
 * $10k so ticks at $500 steps never collapse into duplicate labels like "$2k, $2k".
 */
export function formatAxisDollars(value: number): string {
  if (Math.abs(value) < 1000) return `$${Math.round(value)}`;
  const thousands = value / 1000;
  const label = Math.abs(thousands) >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
  return `$${label}k`;
}

/** The recap's title: "2026 in Bloom" once the year is over, "2026 so far" while it's running. */
export function recapTitle(recap: Pick<YearInReview, "year" | "isYearComplete">): string {
  return recap.isYearComplete ? `${recap.year} in Bloom` : `${recap.year} so far`;
}

/** Builds the highlight cards, skipping any the year has no data for. */
export function buildRecapHighlights(
  recap: YearInReview,
  formatMoney: (amount: number) => string
): RecapHighlight[] {
  const highlights: RecapHighlight[] = [];
  const [topCategory] = recap.topCategories;

  if (recap.bestSavingMonth && recap.bestSavingMonth.netSaved > 0) {
    highlights.push({
      id: "bestSavingMonth",
      label: "Best month",
      value: formatMonthName(recap.bestSavingMonth.month),
      detail: `${formatMoney(recap.bestSavingMonth.netSaved)} left over`,
    });
  }
  if (recap.highestSpendingMonth) {
    highlights.push({
      id: "highestSpendingMonth",
      label: "Biggest spending month",
      value: formatMonthName(recap.highestSpendingMonth.month),
      detail: `${formatMoney(recap.highestSpendingMonth.spending)} spent`,
    });
  }
  if (topCategory) {
    highlights.push({
      id: "topCategory",
      label: "Top category",
      value: topCategory.category,
      detail: `${Math.round(topCategory.shareOfSpending * 100)}% of spending`,
    });
  }
  if (recap.topMerchant) {
    highlights.push({
      id: "topMerchant",
      label: "Most visited",
      value: recap.topMerchant.label,
      detail: `${recap.topMerchant.visitCount} visit${recap.topMerchant.visitCount === 1 ? "" : "s"} · ${formatMoney(recap.topMerchant.spending)}`,
    });
  }
  if (recap.biggestExpense) {
    highlights.push({
      id: "biggestExpense",
      label: "Biggest purchase",
      value: recap.biggestExpense.label,
      detail: formatMoney(recap.biggestExpense.amount),
    });
  }
  if (recap.goalsReached.length > 0) {
    highlights.push({
      id: "goalsReached",
      label: recap.goalsReached.length === 1 ? "Goal reached" : "Goals reached",
      value: String(recap.goalsReached.length),
      detail: recap.goalsReached.join(", "),
    });
  }
  if (recap.reviewsCompleted > 0) {
    highlights.push({
      id: "reviewsCompleted",
      label: "Monthly reviews",
      value: String(recap.reviewsCompleted),
      detail: recap.reviewsCompleted === 1 ? "month reviewed" : "months reviewed",
    });
  }
  return highlights;
}

/**
 * The recap as plain text for the "Copy recap" button. Amounts are included deliberately — it's
 * the user's own summary to paste wherever they choose.
 */
export function buildRecapShareText(
  recap: YearInReview,
  formatMoney: (amount: number) => string
): string {
  const lines = [`${recapTitle(recap)} 🌱`];
  lines.push(`Money in: ${formatMoney(recap.totals.income)}`);
  lines.push(`Money out: ${formatMoney(recap.totals.spending)}`);
  if (recap.totals.netSaved >= 0) {
    lines.push(`Saved: ${formatMoney(recap.totals.netSaved)}`);
  } else {
    lines.push(`Overspent: ${formatMoney(Math.abs(recap.totals.netSaved))}`);
  }
  if (recap.totals.savingsRate !== null && recap.totals.savingsRate > 0) {
    lines.push(`Savings rate: ${Math.round(recap.totals.savingsRate * 100)}%`);
  }
  for (const highlight of buildRecapHighlights(recap, formatMoney)) {
    lines.push(
      `${highlight.label}: ${highlight.value}${highlight.detail ? ` (${highlight.detail})` : ""}`
    );
  }
  return lines.join("\n");
}
