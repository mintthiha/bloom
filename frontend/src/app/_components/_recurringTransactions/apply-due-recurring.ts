import { api, ApplyRecurringResult } from "@/lib/api";

let inFlight: Promise<ApplyRecurringResult> | null = null;

/**
 * Applies all due recurring transactions, de-duping concurrent callers within this tab (e.g. the
 * login auto-apply racing the manual "Apply due" button) so the same due occurrence is only
 * requested once. Dispatches "recurring-changed" on success so other cards can refresh.
 */
export async function runApplyDueRecurringTransactions(): Promise<ApplyRecurringResult> {
  if (inFlight) return inFlight;

  inFlight = api.applyDueRecurringTransactions().finally(() => {
    inFlight = null;
  });

  const result = await inFlight;
  window.dispatchEvent(new CustomEvent("recurring-changed"));
  return result;
}
