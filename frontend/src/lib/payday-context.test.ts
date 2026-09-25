import { describe, expect, it } from "vitest";
import { computePaydayContext, PayCycleProfile } from "@/lib/payday-context";
import { SafeToSpendBillItem } from "@/lib/safe-to-spend";

const PROFILE: PayCycleProfile = { payFrequency: "BIWEEKLY", nextPayday: "2026-09-25" };

/** Builds a bill occurrence on the given date. */
function makeBill(date: string, amount: number): SafeToSpendBillItem {
  return { key: `${date}-${amount}`, label: "Bill", amount, date };
}

describe("computePaydayContext", () => {
  it("returns null when no pay cycle is saved", () => {
    expect(computePaydayContext([], null, new Date(2026, 8, 20))).toBeNull();
    expect(
      computePaydayContext([], { payFrequency: "WEEKLY", nextPayday: null }, new Date(2026, 8, 20))
    ).toBeNull();
    expect(
      computePaydayContext(
        [],
        { payFrequency: null, nextPayday: "2026-09-25" },
        new Date(2026, 8, 20)
      )
    ).toBeNull();
  });

  it("splits bills around the payday", () => {
    const bills = [makeBill("2026-09-22", 200), makeBill("2026-09-28", 800)];

    const context = computePaydayContext(bills, PROFILE, new Date(2026, 8, 20));

    expect(context?.billsBeforePayday).toBe(200);
    expect(context?.billsAfterPayday).toBe(800);
  });

  it("counts a bill dated on payday as covered by that cheque", () => {
    const bills = [makeBill("2026-09-25", 500)];

    const context = computePaydayContext(bills, PROFILE, new Date(2026, 8, 20));

    expect(context?.billsBeforePayday).toBe(0);
    expect(context?.billsAfterPayday).toBe(500);
  });

  it("reports zero on both sides when there are no bills", () => {
    const context = computePaydayContext([], PROFILE, new Date(2026, 8, 20));

    expect(context?.billsBeforePayday).toBe(0);
    expect(context?.billsAfterPayday).toBe(0);
  });

  it("counts down to the payday", () => {
    const context = computePaydayContext([], PROFILE, new Date(2026, 8, 20));

    expect(context?.payday).toBe("2026-09-25");
    expect(context?.daysUntilPayday).toBe(5);
  });

  it("rolls a stale anchor date forward", () => {
    const context = computePaydayContext(
      [],
      { payFrequency: "BIWEEKLY", nextPayday: "2026-01-02" },
      new Date(2026, 8, 20)
    );

    // The 14-day series from Jan 2 next lands on Sep 25.
    expect(context?.payday).toBe("2026-09-25");
  });

  // Regression: deriving "today" from UTC made the countdown a day short late in the evening
  // west of Greenwich, disagreeing with the rest of the app's local-date arithmetic.
  it("counts from the local calendar day late at night", () => {
    const context = computePaydayContext([], PROFILE, new Date(2026, 8, 20, 23, 57));

    expect(context?.daysUntilPayday).toBe(5);
  });
});
