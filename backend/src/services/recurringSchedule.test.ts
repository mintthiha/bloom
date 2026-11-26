import { describe, expect, it } from "vitest";
import { advanceRunDate, planSkipMissedOccurrences } from "./recurringSchedule";

describe("advanceRunDate", () => {
  it("steps weekly, bi-weekly and monthly in UTC", () => {
    const start = new Date("2026-07-29T12:00:00.000Z");
    expect(advanceRunDate(start, "WEEKLY").toISOString()).toBe("2026-08-05T12:00:00.000Z");
    expect(advanceRunDate(start, "BIWEEKLY").toISOString()).toBe("2026-08-12T12:00:00.000Z");
    expect(advanceRunDate(start, "MONTHLY").toISOString()).toBe("2026-08-29T12:00:00.000Z");
  });

  it("does not mutate the date it is given", () => {
    const start = new Date("2026-07-29T12:00:00.000Z");
    advanceRunDate(start, "MONTHLY");
    expect(start.toISOString()).toBe("2026-07-29T12:00:00.000Z");
  });
});

describe("planSkipMissedOccurrences", () => {
  it("skips every missed monthly payment and lands on the next upcoming one", () => {
    // Rent due Jul 29, Aug 29, Sep 29, Oct 29 — all missed by Nov 22.
    const plan = planSkipMissedOccurrences(
      { nextRunAt: new Date("2026-07-29T12:00:00.000Z"), endDate: null, frequency: "MONTHLY" },
      new Date("2026-11-22T12:00:00.000Z")
    );

    expect(plan).toEqual({
      skippedCount: 4,
      nextRunAt: new Date("2026-11-29T12:00:00.000Z"),
      shouldDeactivate: false,
    });
  });

  it("skips an occurrence that falls exactly on now, matching what apply-due would post", () => {
    const plan = planSkipMissedOccurrences(
      { nextRunAt: new Date("2026-11-22T12:00:00.000Z"), endDate: null, frequency: "WEEKLY" },
      new Date("2026-11-22T12:00:00.000Z")
    );

    expect(plan.skippedCount).toBe(1);
    expect(plan.nextRunAt.toISOString()).toBe("2026-11-29T12:00:00.000Z");
  });

  it("skips nothing when the next run is still in the future", () => {
    const plan = planSkipMissedOccurrences(
      { nextRunAt: new Date("2026-11-29T12:00:00.000Z"), endDate: null, frequency: "MONTHLY" },
      new Date("2026-11-22T12:00:00.000Z")
    );

    expect(plan).toEqual({
      skippedCount: 0,
      nextRunAt: new Date("2026-11-29T12:00:00.000Z"),
      shouldDeactivate: false,
    });
  });

  it("stops at the end date and marks the rule to deactivate", () => {
    // Bi-weekly from Sep 1 with an end date of Oct 1: Sep 1 and Sep 15 and Sep 29 count, Oct 13 doesn't.
    const plan = planSkipMissedOccurrences(
      {
        nextRunAt: new Date("2026-09-01T12:00:00.000Z"),
        endDate: new Date("2026-10-01T12:00:00.000Z"),
        frequency: "BIWEEKLY",
      },
      new Date("2026-11-22T12:00:00.000Z")
    );

    expect(plan.skippedCount).toBe(3);
    expect(plan.nextRunAt.toISOString()).toBe("2026-10-13T12:00:00.000Z");
    expect(plan.shouldDeactivate).toBe(true);
  });

  it("keeps the rule active when the end date is still ahead of the new next run", () => {
    const plan = planSkipMissedOccurrences(
      {
        nextRunAt: new Date("2026-10-29T12:00:00.000Z"),
        endDate: new Date("2027-06-30T12:00:00.000Z"),
        frequency: "MONTHLY",
      },
      new Date("2026-11-22T12:00:00.000Z")
    );

    expect(plan.skippedCount).toBe(1);
    expect(plan.shouldDeactivate).toBe(false);
  });

  it("skips nothing and deactivates when the next run is already past the end date", () => {
    const plan = planSkipMissedOccurrences(
      {
        nextRunAt: new Date("2026-04-01T12:00:00.000Z"),
        endDate: new Date("2026-03-31T12:00:00.000Z"),
        frequency: "MONTHLY",
      },
      new Date("2026-11-22T12:00:00.000Z")
    );

    expect(plan.skippedCount).toBe(0);
    expect(plan.shouldDeactivate).toBe(true);
  });
});
