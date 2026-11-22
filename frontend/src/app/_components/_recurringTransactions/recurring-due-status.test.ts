import { describe, expect, it } from "vitest";
import type { RecurringTransaction } from "@/lib/api";
import {
  getRuleDueStatus,
  MAX_COUNTED_OCCURRENCES,
  sortDueRulesFirst,
} from "./recurring-due-status";

const NOW = new Date("2026-11-21T12:00:00.000Z");

/** Builds an active monthly $1,200 rule with the given next run date. */
function makeRule(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: "rule-1",
    name: "Rent",
    amount: 1200,
    frequency: "MONTHLY",
    nextRunAt: "2026-07-29T12:00:00.000Z",
    endDate: null,
    active: true,
    ...overrides,
  } as RecurringTransaction;
}

describe("getRuleDueStatus", () => {
  it("counts every monthly occurrence missed since the next run date", () => {
    // Jul 29, Aug 29, Sep 29, Oct 29 are past; Nov 29 is still ahead.
    expect(getRuleDueStatus(makeRule(), NOW)).toEqual({
      isDue: true,
      pendingOccurrenceCount: 4,
      pendingTotal: 4800,
    });
  });

  it("is not due when the next run date is in the future", () => {
    expect(getRuleDueStatus(makeRule({ nextRunAt: "2026-11-28T12:00:00.000Z" }), NOW)).toEqual({
      isDue: false,
      pendingOccurrenceCount: 0,
      pendingTotal: 0,
    });
  });

  it("is due when the next run is exactly now", () => {
    expect(
      getRuleDueStatus(makeRule({ nextRunAt: NOW.toISOString() }), NOW).pendingOccurrenceCount
    ).toBe(1);
  });

  it("never reports a paused rule as due", () => {
    expect(getRuleDueStatus(makeRule({ active: false }), NOW).isDue).toBe(false);
  });

  it("stops counting at the end date", () => {
    // Jul 29 and Aug 29 fall on or before the Sep 1 end date; later months don't.
    expect(
      getRuleDueStatus(makeRule({ endDate: "2026-09-01T12:00:00.000Z" }), NOW)
        .pendingOccurrenceCount
    ).toBe(2);
  });

  it("steps weekly and biweekly rules by 7 and 14 days", () => {
    const nextRunAt = "2026-11-01T12:00:00.000Z";
    // Nov 1, 8, 15 are past; Nov 22 is ahead.
    expect(
      getRuleDueStatus(makeRule({ frequency: "WEEKLY", nextRunAt }), NOW).pendingOccurrenceCount
    ).toBe(3);
    // Nov 1, 15 are past; Nov 29 is ahead.
    expect(
      getRuleDueStatus(makeRule({ frequency: "BIWEEKLY", nextRunAt }), NOW).pendingOccurrenceCount
    ).toBe(2);
  });

  it("caps the count for a very old rule", () => {
    const status = getRuleDueStatus(
      makeRule({ frequency: "WEEKLY", nextRunAt: "2020-01-01T12:00:00.000Z" }),
      NOW
    );
    expect(status.pendingOccurrenceCount).toBe(MAX_COUNTED_OCCURRENCES);
  });
});

describe("sortDueRulesFirst", () => {
  it("moves due rules to the top and keeps the rest in their original order", () => {
    const future = "2026-12-01T12:00:00.000Z";
    const rules = [
      makeRule({ id: "a", nextRunAt: future }),
      makeRule({ id: "b" }),
      makeRule({ id: "c", nextRunAt: future }),
      makeRule({ id: "d" }),
    ];

    expect(sortDueRulesFirst(rules, NOW).map((rule) => rule.id)).toEqual(["b", "d", "a", "c"]);
  });
});
