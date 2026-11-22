import { describe, expect, it } from "vitest";
import type { ApplyRecurringResult, RecurringTransaction } from "@/lib/api";
import { describeApplyDueResult } from "./apply-due-feedback";

const RULES = [
  { id: "rule-rent", name: "Rent" },
  { id: "rule-gym", name: "Gym" },
] as RecurringTransaction[];

/** Builds an apply-due result with the given applied count and failures. */
function makeResult(
  appliedCount: number,
  failures: Array<{ recurringTransactionId: string; message: string }>
): ApplyRecurringResult {
  return {
    appliedCount,
    failedCount: failures.length,
    applied: [],
    failures: failures.map((failure) => ({
      ...failure,
      accountId: "account-1",
      occurrenceAt: "2026-11-01T00:00:00.000Z",
    })),
  };
}

describe("describeApplyDueResult", () => {
  it("reports how many were applied, singular and plural", () => {
    expect(describeApplyDueResult(makeResult(1, []), RULES)).toEqual({
      successMessage: "Applied 1 recurring transaction",
      errorMessage: null,
    });
    expect(describeApplyDueResult(makeResult(3, []), RULES).successMessage).toBe(
      "Applied 3 recurring transactions"
    );
  });

  it("says nothing was due when nothing was applied or failed", () => {
    expect(describeApplyDueResult(makeResult(0, []), RULES)).toEqual({
      successMessage: "No recurring transactions are due",
      errorMessage: null,
    });
  });

  it("names the failed rule and the backend's reason", () => {
    const feedback = describeApplyDueResult(
      makeResult(0, [{ recurringTransactionId: "rule-rent", message: "Insufficient funds" }]),
      RULES
    );

    expect(feedback).toEqual({
      successMessage: null,
      errorMessage: `Couldn't apply "Rent": Insufficient funds`,
    });
  });

  it("counts several failures and describes the first", () => {
    const feedback = describeApplyDueResult(
      makeResult(0, [
        { recurringTransactionId: "rule-rent", message: "Insufficient funds" },
        { recurringTransactionId: "rule-gym", message: "Account is frozen" },
      ]),
      RULES
    );

    expect(feedback.errorMessage).toBe(
      `Couldn't apply 2 recurring transactions. First: "Rent": Insufficient funds`
    );
  });

  it("reports both outcomes when a run partly succeeds", () => {
    const feedback = describeApplyDueResult(
      makeResult(2, [{ recurringTransactionId: "rule-gym", message: "Account is frozen" }]),
      RULES
    );

    expect(feedback).toEqual({
      successMessage: "Applied 2 recurring transactions",
      errorMessage: `Couldn't apply "Gym": Account is frozen`,
    });
  });

  it("uses a generic name when the failed rule isn't in the list", () => {
    const feedback = describeApplyDueResult(
      makeResult(0, [{ recurringTransactionId: "rule-unknown", message: "Insufficient funds" }]),
      RULES
    );

    expect(feedback.errorMessage).toBe(
      "Couldn't apply a recurring transaction: Insufficient funds"
    );
  });
});
