import { describe, expect, it } from "vitest";
import { calculateGoalPace, formatTargetDate, formatTargetMonth, GoalPaceInput } from "./goal-pace";

const TODAY = new Date("2026-10-07T15:30:00Z");

/** Builds a goal-pace input; override only the fields a test cares about. */
function makeGoal(overrides: Partial<GoalPaceInput> = {}): GoalPaceInput {
  return {
    currentBalance: 1000,
    targetAmount: 5000,
    targetDate: null,
    ...overrides,
  };
}

describe("calculateGoalPace", () => {
  describe("COMPLETE", () => {
    it("reports the goal as reached when the balance matches the target", () => {
      const pace = calculateGoalPace(makeGoal({ currentBalance: 5000, targetAmount: 5000 }), TODAY);

      expect(pace.status).toBe("COMPLETE");
      expect(pace.remainingAmount).toBe(0);
      expect(pace.requiredMonthlyContribution).toBeNull();
      expect(pace.summary).toBe("Goal reached — nothing left to save.");
    });

    it("reports the goal as reached when the balance overshoots the target", () => {
      const pace = calculateGoalPace(
        makeGoal({ currentBalance: 7500, targetAmount: 5000, targetDate: "2027-06-30" }),
        TODAY
      );

      expect(pace.status).toBe("COMPLETE");
      expect(pace.remainingAmount).toBe(0);
    });

    it("still reports the days left when a reached goal has a target date", () => {
      const pace = calculateGoalPace(
        makeGoal({ currentBalance: 5000, targetAmount: 5000, targetDate: "2026-10-17" }),
        TODAY
      );

      expect(pace.daysRemaining).toBe(10);
    });

    it("takes precedence over a passed target date", () => {
      const pace = calculateGoalPace(
        makeGoal({ currentBalance: 5000, targetAmount: 5000, targetDate: "2026-01-01" }),
        TODAY
      );

      expect(pace.status).toBe("COMPLETE");
    });
  });

  describe("NO_TARGET_DATE", () => {
    it("reports only the remaining amount when no target date is set", () => {
      const pace = calculateGoalPace(makeGoal({ targetDate: null }), TODAY);

      expect(pace.status).toBe("NO_TARGET_DATE");
      expect(pace.remainingAmount).toBe(4000);
      expect(pace.daysRemaining).toBeNull();
      expect(pace.requiredMonthlyContribution).toBeNull();
      expect(pace.requiredWeeklyContribution).toBeNull();
      expect(pace.summary).toBe("$4,000.00 to go — add a target date to see a monthly pace.");
    });

    it("treats an unparseable target date as no target date", () => {
      const pace = calculateGoalPace(makeGoal({ targetDate: "2026-02-31" }), TODAY);

      expect(pace.status).toBe("NO_TARGET_DATE");
    });
  });

  describe("PAST_DUE", () => {
    it("reports the shortfall when the target date is in the past", () => {
      const pace = calculateGoalPace(
        makeGoal({ currentBalance: 2500, targetAmount: 5000, targetDate: "2026-09-30" }),
        TODAY
      );

      expect(pace.status).toBe("PAST_DUE");
      expect(pace.daysRemaining).toBe(-7);
      expect(pace.remainingAmount).toBe(2500);
      expect(pace.requiredMonthlyContribution).toBeNull();
      expect(pace.summary).toBe("Target date has passed — still $2,500.00 to go.");
    });

    it("treats yesterday as past due", () => {
      const pace = calculateGoalPace(makeGoal({ targetDate: "2026-10-06" }), TODAY);

      expect(pace.status).toBe("PAST_DUE");
      expect(pace.daysRemaining).toBe(-1);
    });
  });

  describe("DUE_SOON", () => {
    it("quotes a weekly pace when the target date is today", () => {
      const pace = calculateGoalPace(makeGoal({ targetDate: "2026-10-07" }), TODAY);

      expect(pace.status).toBe("DUE_SOON");
      expect(pace.daysRemaining).toBe(0);
      expect(pace.requiredWeeklyContribution).toBe(4000);
      expect(pace.summary).toBe("$4,000.00 to go and the target date is today.");
    });

    it("floors the period at one week so a few days left do not inflate the figure", () => {
      const pace = calculateGoalPace(makeGoal({ targetDate: "2026-10-10" }), TODAY);

      expect(pace.status).toBe("DUE_SOON");
      expect(pace.requiredWeeklyContribution).toBe(4000);
      expect(pace.summary).toBe("Save $4,000.00/week to make it with 3 days left.");
    });

    it("uses the singular day form with one day left", () => {
      const pace = calculateGoalPace(makeGoal({ targetDate: "2026-10-08" }), TODAY);

      expect(pace.summary).toBe("Save $4,000.00/week to make it with 1 day left.");
    });

    it("splits the remainder across whole weeks when more than a week is left", () => {
      const pace = calculateGoalPace(makeGoal({ targetDate: "2026-10-28" }), TODAY);

      expect(pace.daysRemaining).toBe(21);
      expect(pace.requiredWeeklyContribution).toBeCloseTo(1333.34, 2);
    });

    it("still applies at the 31-day boundary", () => {
      const pace = calculateGoalPace(makeGoal({ targetDate: "2026-11-07" }), TODAY);

      expect(pace.daysRemaining).toBe(31);
      expect(pace.status).toBe("DUE_SOON");
    });
  });

  describe("ON_SCHEDULE", () => {
    it("switches to a monthly pace just past the 31-day boundary", () => {
      const pace = calculateGoalPace(makeGoal({ targetDate: "2026-11-08" }), TODAY);

      expect(pace.daysRemaining).toBe(32);
      expect(pace.status).toBe("ON_SCHEDULE");
    });

    it("divides the remainder across the months left and names the target month", () => {
      // 2026-10-07 → 2027-06-30 is 266 days ≈ 8.739 months; $3,000 / 8.739 ≈ $343.28.
      const pace = calculateGoalPace(
        makeGoal({ currentBalance: 2000, targetAmount: 5000, targetDate: "2027-06-30" }),
        TODAY
      );

      expect(pace.status).toBe("ON_SCHEDULE");
      expect(pace.daysRemaining).toBe(266);
      expect(pace.requiredMonthlyContribution).toBe(343.28);
      expect(pace.summary).toBe("Save $343.28/month to make it by Jun 2027.");
    });

    it("rounds the monthly contribution up to the cent so it never undershoots", () => {
      // 100 days ≈ 3.285 months; $1,000 / 3.285 = $304.37 (rounded up from $304.3687…).
      const pace = calculateGoalPace(
        makeGoal({ currentBalance: 0, targetAmount: 1000, targetDate: "2027-01-15" }),
        TODAY
      );

      expect(pace.daysRemaining).toBe(100);
      expect(pace.requiredMonthlyContribution).toBe(304.37);
    });
  });
});

describe("formatTargetMonth", () => {
  it("renders a short month and year", () => {
    expect(formatTargetMonth("2027-06-30")).toBe("Jun 2027");
  });

  it("does not drift to the previous month in negative-offset timezones", () => {
    expect(formatTargetMonth("2027-06-01")).toBe("Jun 2027");
  });

  it("falls back to a neutral phrase when the date is missing", () => {
    expect(formatTargetMonth(null)).toBe("your target date");
  });
});

describe("formatTargetDate", () => {
  it("renders a short day, month, and year", () => {
    expect(formatTargetDate("2027-06-30")).toBe("Jun 30, 2027");
  });

  it("returns null when the date is missing or invalid", () => {
    expect(formatTargetDate(null)).toBeNull();
    expect(formatTargetDate("not-a-date")).toBeNull();
  });
});
