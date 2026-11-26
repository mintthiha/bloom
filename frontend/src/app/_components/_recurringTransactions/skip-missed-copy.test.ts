import { describe, expect, it } from "vitest";
import type { RecurringTransaction } from "@/lib/api";
import type { RuleDueStatus } from "./recurring-due-status";
import { describeSkipMissedConfirmation, describeSkipMissedSuccess } from "./skip-missed-copy";

const RENT_RULE = {
  id: "rule-1",
  name: "Rent",
  amount: 1200,
  frequency: "MONTHLY",
  nextRunAt: "2026-07-29T12:00:00.000Z",
  endDate: null,
  active: true,
} as RecurringTransaction;

/** Formats amounts as whole dollars so assertions stay readable. */
function formatWholeDollars(amount: number): string {
  return `$${amount.toLocaleString("en-CA")}`;
}

/** Builds a due status for four missed Rent payments, picking up on Nov 29. */
function makeDueStatus(overrides: Partial<RuleDueStatus> = {}): RuleDueStatus {
  return {
    isDue: true,
    pendingOccurrenceCount: 4,
    pendingTotal: 4800,
    nextUpcomingRunAt: new Date("2026-11-29T12:00:00.000Z"),
    endsAfterPending: false,
    ...overrides,
  };
}

describe("describeSkipMissedConfirmation", () => {
  it("names the count, the oldest date, the total, and where the schedule resumes", () => {
    const { title, description } = describeSkipMissedConfirmation(
      RENT_RULE,
      makeDueStatus(),
      formatWholeDollars
    );

    expect(title).toBe('Skip 4 missed payments for "Rent"?');
    expect(description).toContain("The 4 missed payments due since Jul 29, 2026 ($4,800)");
    expect(description).toContain("no account balance changes");
    expect(description).toContain('"Rent" picks up again on Nov 29, 2026.');
  });

  it("uses the singular for one missed payment", () => {
    const { title } = describeSkipMissedConfirmation(
      RENT_RULE,
      makeDueStatus({ pendingOccurrenceCount: 1, pendingTotal: 1200 }),
      formatWholeDollars
    );

    expect(title).toBe('Skip 1 missed payment for "Rent"?');
  });

  it("says the rule stops when its end date has passed", () => {
    const { description } = describeSkipMissedConfirmation(
      RENT_RULE,
      makeDueStatus({ nextUpcomingRunAt: null, endsAfterPending: true }),
      formatWholeDollars
    );

    expect(description).toContain('"Rent" is past its end date, so it will stop after this.');
  });

  it("shows a capped count with a plus and falls back to a generic resume line", () => {
    const { title, description } = describeSkipMissedConfirmation(
      RENT_RULE,
      makeDueStatus({ pendingOccurrenceCount: 100, nextUpcomingRunAt: null }),
      formatWholeDollars
    );

    expect(title).toBe('Skip 100+ missed payments for "Rent"?');
    expect(description).toContain('"Rent" picks up again at its next upcoming date.');
  });
});

describe("describeSkipMissedSuccess", () => {
  it("reports the skipped count with the right plural", () => {
    expect(describeSkipMissedSuccess("Rent", 4)).toBe('Skipped 4 missed payments for "Rent"');
    expect(describeSkipMissedSuccess("Rent", 1)).toBe('Skipped 1 missed payment for "Rent"');
  });
});
