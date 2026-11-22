import type { ApplyRecurringResult, RecurringTransaction } from "@/lib/api";

/** What to tell the user after "Apply due": a success line, a failure line, or both (partial run). */
export type ApplyDueFeedback = {
  successMessage: string | null;
  errorMessage: string | null;
};

/**
 * Turns an apply-due result into toast copy. Failures name the rule and the backend's reason
 * (e.g. "Insufficient funds"), so the user knows which rule to fix instead of the click seeming
 * to do nothing. When nothing was due and nothing failed, says so.
 */
export function describeApplyDueResult(
  result: ApplyRecurringResult,
  rules: RecurringTransaction[]
): ApplyDueFeedback {
  const successMessage =
    result.appliedCount > 0
      ? `Applied ${result.appliedCount} recurring transaction${result.appliedCount === 1 ? "" : "s"}`
      : null;

  let errorMessage: string | null = null;
  const [firstFailure] = result.failures;
  if (result.failedCount > 0) {
    const failedRuleName = rules.find(
      (rule) => rule.id === firstFailure?.recurringTransactionId
    )?.name;
    const reason = firstFailure?.message ?? "it could not be applied";
    const failureDescription = `${failedRuleName ? `"${failedRuleName}"` : "a recurring transaction"}: ${reason}`;
    errorMessage =
      result.failedCount === 1
        ? `Couldn't apply ${failureDescription}`
        : `Couldn't apply ${result.failedCount} recurring transactions. First: ${failureDescription}`;
  }

  if (!successMessage && !errorMessage) {
    return { successMessage: "No recurring transactions are due", errorMessage: null };
  }
  return { successMessage, errorMessage };
}
