// Which steps the guided review shows, in order. Steps with nothing to show are skipped so a user
// without budgets or goals isn't walked through empty screens.
import type { MonthlyReview } from "@/lib/api";

export type ReviewStepId = "cashFlow" | "categories" | "budgets" | "goals" | "finish";

/** The short label each step shows in the progress row. */
export const REVIEW_STEP_LABELS: Record<ReviewStepId, string> = {
  cashFlow: "The numbers",
  categories: "Where it went",
  budgets: "Budgets",
  goals: "Goals",
  finish: "Wrap up",
};

/** Builds the step list for a review: always the numbers and the wrap-up, the rest when relevant. */
export function buildReviewSteps(
  review: Pick<MonthlyReview, "topCategories" | "budgets" | "goals">
): ReviewStepId[] {
  const steps: ReviewStepId[] = ["cashFlow"];
  if (review.topCategories.length > 0) steps.push("categories");
  if (review.budgets.length > 0) steps.push("budgets");
  if (review.goals.length > 0) steps.push("goals");
  steps.push("finish");
  return steps;
}
