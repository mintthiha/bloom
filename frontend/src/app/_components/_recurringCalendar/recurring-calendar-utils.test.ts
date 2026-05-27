import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeUpcomingOccurrences,
  formatRelativeDate,
  groupOccurrencesByMonth,
  type RecurringOccurrence,
} from "./recurring-calendar-utils";
import type { RecurringTransaction } from "@/lib/api";

// Pin to 2026-05-15. In UTC this gives:
//   today       = "2026-05-15"
//   cutoffDate  = "2026-08-13"  (today + 90 days)
const FIXED_NOW = new Date("2026-05-15T12:00:00.000Z");

/** Creates a minimal active RecurringTransaction for testing. */
function makeRule(
  overrides: Partial<RecurringTransaction> & { frequency: RecurringTransaction["frequency"]; nextRunAt: string }
): RecurringTransaction {
  return {
    id: "r-1",
    userId: "u-1",
    accountId: "a-1",
    name: "Test Rule",
    type: "WITHDRAWAL",
    amount: 100,
    category: null,
    merchant: null,
    description: null,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: null,
    lastRunAt: null,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    accountOwnerName: "Test",
    accountNickname: null,
    accountType: "CHEQUING",
    ...overrides,
  };
}

/** Creates a minimal RecurringOccurrence for groupOccurrencesByMonth tests. */
function makeOccurrence(occurrenceDate: string, id = "r-1"): RecurringOccurrence {
  return {
    key: `${id}-${occurrenceDate}`,
    rule: makeRule({ frequency: "MONTHLY", nextRunAt: occurrenceDate, id }),
    occurrenceDate,
    status: "upcoming",
  };
}

// ---------------------------------------------------------------------------
// computeUpcomingOccurrences
// ---------------------------------------------------------------------------

describe("computeUpcomingOccurrences", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("returns an empty array when there are no rules", () => {
    expect(computeUpcomingOccurrences([])).toEqual([]);
  });

  it("skips inactive rules entirely", () => {
    const rule = makeRule({ frequency: "MONTHLY", nextRunAt: "2026-05-20T00:00:00.000Z", active: false });
    expect(computeUpcomingOccurrences([rule])).toHaveLength(0);
  });

  it("generates MONTHLY occurrences advancing by one calendar month each time", () => {
    // Starting May 15 → Jun 15 → Jul 15; Aug 15 > cutoff Aug 13 → excluded
    const rule = makeRule({ frequency: "MONTHLY", nextRunAt: "2026-05-15T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    expect(result.map((o) => o.occurrenceDate)).toEqual(["2026-05-15", "2026-06-15", "2026-07-15"]);
  });

  it("generates WEEKLY occurrences advancing by 7 days each time", () => {
    const rule = makeRule({ frequency: "WEEKLY", nextRunAt: "2026-05-20T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    const dates = result.map((o) => o.occurrenceDate);
    expect(dates[0]).toBe("2026-05-20");
    expect(dates[1]).toBe("2026-05-27");
    expect(dates[2]).toBe("2026-06-03");
  });

  it("generates BIWEEKLY occurrences advancing by 14 days each time", () => {
    const rule = makeRule({ frequency: "BIWEEKLY", nextRunAt: "2026-05-20T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    const dates = result.map((o) => o.occurrenceDate);
    expect(dates[0]).toBe("2026-05-20");
    expect(dates[1]).toBe("2026-06-03");
    expect(dates[2]).toBe("2026-06-17");
  });

  it("includes overdue occurrences (nextRunAt before today) with status 'overdue'", () => {
    // May 10 is 5 days before today (May 15)
    const rule = makeRule({ frequency: "MONTHLY", nextRunAt: "2026-05-10T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    expect(result[0]).toMatchObject({ occurrenceDate: "2026-05-10", status: "overdue" });
  });

  it("classifies today's occurrence as 'due-soon' (diff = 0)", () => {
    const rule = makeRule({ frequency: "MONTHLY", nextRunAt: "2026-05-15T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    expect(result[0]).toMatchObject({ occurrenceDate: "2026-05-15", status: "due-soon" });
  });

  it("classifies an occurrence 7 days away as 'due-soon' (boundary at DUE_SOON_THRESHOLD)", () => {
    const rule = makeRule({ frequency: "MONTHLY", nextRunAt: "2026-05-22T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    expect(result[0]).toMatchObject({ occurrenceDate: "2026-05-22", status: "due-soon" });
  });

  it("classifies an occurrence 8 days away as 'upcoming'", () => {
    const rule = makeRule({ frequency: "MONTHLY", nextRunAt: "2026-05-23T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    expect(result[0]).toMatchObject({ occurrenceDate: "2026-05-23", status: "upcoming" });
  });

  it("stops generating occurrences after the rule's endDate", () => {
    // May 15 is included; Jun 15 > endDate Jun 1 → excluded
    const rule = makeRule({
      id: "r-1",
      frequency: "MONTHLY",
      nextRunAt: "2026-05-15T00:00:00.000Z",
      endDate: "2026-06-01T00:00:00.000Z",
    });
    const result = computeUpcomingOccurrences([rule]);

    expect(result.map((o) => o.occurrenceDate)).toEqual(["2026-05-15"]);
  });

  it("generates no more than 12 occurrences per rule (MAX_OCCURRENCES_PER_RULE)", () => {
    // A weekly rule starting today would produce 13 occurrences within 90 days
    const rule = makeRule({ frequency: "WEEKLY", nextRunAt: "2026-05-15T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    expect(result.length).toBeLessThanOrEqual(12);
    expect(result).toHaveLength(12);
  });

  it("excludes occurrences beyond the 90-day window", () => {
    // A monthly rule starting Jul 15: Jul 15 is within 90 days; Aug 15 is not
    const rule = makeRule({ frequency: "MONTHLY", nextRunAt: "2026-07-15T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    const dates = result.map((o) => o.occurrenceDate);
    expect(dates).toContain("2026-07-15");
    expect(dates.every((d) => d <= "2026-08-13")).toBe(true);
  });

  it("merges and sorts occurrences from multiple rules by date ascending", () => {
    const ruleA = makeRule({ id: "r-a", frequency: "MONTHLY", nextRunAt: "2026-06-01T00:00:00.000Z" });
    const ruleB = makeRule({ id: "r-b", frequency: "MONTHLY", nextRunAt: "2026-05-20T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([ruleA, ruleB]);

    const dates = result.map((o) => o.occurrenceDate);
    expect(dates[0]).toBe("2026-05-20"); // ruleB comes first
    expect(dates[1]).toBe("2026-06-01"); // then ruleA
  });

  it("keys each occurrence as '<ruleId>-<date>'", () => {
    const rule = makeRule({ id: "rule-xyz", frequency: "MONTHLY", nextRunAt: "2026-06-01T00:00:00.000Z" });
    const result = computeUpcomingOccurrences([rule]);

    expect(result[0].key).toBe("rule-xyz-2026-06-01");
  });
});

// ---------------------------------------------------------------------------
// formatRelativeDate
// ---------------------------------------------------------------------------

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW); // today = "2026-05-15"
  });
  afterEach(() => vi.useRealTimers());

  it("returns 'Today' for the current date", () => {
    expect(formatRelativeDate("2026-05-15")).toBe("Today");
  });

  it("returns 'Tomorrow' for the next calendar day", () => {
    expect(formatRelativeDate("2026-05-16")).toBe("Tomorrow");
  });

  it("returns 'Yesterday' for the previous calendar day", () => {
    expect(formatRelativeDate("2026-05-14")).toBe("Yesterday");
  });

  it("returns 'In N days' for dates 2–14 days in the future", () => {
    expect(formatRelativeDate("2026-05-17")).toBe("In 2 days");
    expect(formatRelativeDate("2026-05-20")).toBe("In 5 days");
  });

  it("returns 'In 14 days' at the exact boundary (14 days ahead)", () => {
    expect(formatRelativeDate("2026-05-29")).toBe("In 14 days");
  });

  it("returns a formatted date string for dates more than 14 days in the future", () => {
    // 2026-05-30 is 15 days away — falls through to toLocaleDateString
    const result = formatRelativeDate("2026-05-30");
    expect(result).not.toMatch(/^In \d+ days$/);
    expect(result).not.toBe("Tomorrow");
  });

  it("returns 'N days ago' for dates 2–14 days in the past", () => {
    expect(formatRelativeDate("2026-05-13")).toBe("2 days ago");
    expect(formatRelativeDate("2026-05-10")).toBe("5 days ago");
  });

  it("returns '14 days ago' at the exact boundary (14 days past)", () => {
    expect(formatRelativeDate("2026-05-01")).toBe("14 days ago");
  });

  it("returns a formatted date string for dates more than 14 days in the past", () => {
    // 2026-04-30 is 15 days ago — falls through to toLocaleDateString
    const result = formatRelativeDate("2026-04-30");
    expect(result).not.toMatch(/^\d+ days ago$/);
    expect(result).not.toBe("Yesterday");
  });
});

// ---------------------------------------------------------------------------
// groupOccurrencesByMonth
// ---------------------------------------------------------------------------

describe("groupOccurrencesByMonth", () => {
  it("returns an empty array when given no occurrences", () => {
    expect(groupOccurrencesByMonth([])).toEqual([]);
  });

  it("groups a single occurrence into one month group", () => {
    const groups = groupOccurrencesByMonth([makeOccurrence("2026-05-20")]);

    expect(groups).toHaveLength(1);
    expect(groups[0].occurrences).toHaveLength(1);
    expect(groups[0].occurrences[0].occurrenceDate).toBe("2026-05-20");
  });

  it("groups all occurrences in the same calendar month into a single group", () => {
    const occurrences = [
      makeOccurrence("2026-05-15", "r-1"),
      makeOccurrence("2026-05-22", "r-2"),
      makeOccurrence("2026-05-29", "r-3"),
    ];
    const groups = groupOccurrencesByMonth(occurrences);

    expect(groups).toHaveLength(1);
    expect(groups[0].occurrences).toHaveLength(3);
  });

  it("creates separate groups for occurrences in different calendar months", () => {
    const occurrences = [
      makeOccurrence("2026-05-20", "r-1"),
      makeOccurrence("2026-06-20", "r-2"),
      makeOccurrence("2026-07-20", "r-3"),
    ];
    const groups = groupOccurrencesByMonth(occurrences);

    expect(groups).toHaveLength(3);
    expect(groups[0].occurrences[0].occurrenceDate).toBe("2026-05-20");
    expect(groups[1].occurrences[0].occurrenceDate).toBe("2026-06-20");
    expect(groups[2].occurrences[0].occurrenceDate).toBe("2026-07-20");
  });

  it("preserves the order of occurrences within each group", () => {
    const occurrences = [
      makeOccurrence("2026-05-01", "r-a"),
      makeOccurrence("2026-05-15", "r-b"),
      makeOccurrence("2026-05-31", "r-c"),
    ];
    const groups = groupOccurrencesByMonth(occurrences);

    const dates = groups[0].occurrences.map((o) => o.occurrenceDate);
    expect(dates).toEqual(["2026-05-01", "2026-05-15", "2026-05-31"]);
  });

  it("includes a human-readable month label for each group", () => {
    const groups = groupOccurrencesByMonth([makeOccurrence("2026-05-20")]);

    // Label should contain the month name and year; exact format is locale-dependent
    expect(groups[0].monthLabel).toContain("2026");
    expect(groups[0].monthLabel.toLowerCase()).toContain("may");
  });
});
