import { describe, expect, it } from "vitest";
import type { NotificationPreferences } from "@/lib/api";
import {
  countEnabledAlerts,
  describeEnabledAlerts,
  parseLowBalanceThreshold,
  toggleMilestone,
} from "./notification-preferences";

const ALL_ON: NotificationPreferences = {
  billRemindersEnabled: true,
  billReminderLeadDays: 3,
  budgetOverspendAlertsEnabled: true,
  lowBalanceAlertsEnabled: true,
  lowBalanceThreshold: 100,
  goalMilestoneAlertsEnabled: true,
  goalMilestonePercentages: [50, 75, 100],
  subscriptionPriceAlertsEnabled: true,
};

describe("parseLowBalanceThreshold", () => {
  it("parses a whole dollar amount", () => {
    expect(parseLowBalanceThreshold("250")).toBe(250);
  });

  it("accepts zero", () => {
    expect(parseLowBalanceThreshold("0")).toBe(0);
  });

  it("rounds to cents", () => {
    expect(parseLowBalanceThreshold("99.999")).toBe(100);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseLowBalanceThreshold("  75  ")).toBe(75);
  });

  it("returns null for an empty value", () => {
    expect(parseLowBalanceThreshold("   ")).toBeNull();
  });

  it("returns null for a non-numeric value", () => {
    expect(parseLowBalanceThreshold("lots")).toBeNull();
  });

  it("returns null for a negative amount", () => {
    expect(parseLowBalanceThreshold("-10")).toBeNull();
  });

  it("returns null above the maximum", () => {
    expect(parseLowBalanceThreshold("1000001")).toBeNull();
  });
});

describe("toggleMilestone", () => {
  it("adds a missing milestone in sorted position", () => {
    expect(toggleMilestone([50, 100], 75)).toEqual([50, 75, 100]);
  });

  it("removes a selected milestone", () => {
    expect(toggleMilestone([50, 75, 100], 75)).toEqual([50, 100]);
  });

  it("refuses to remove the last remaining milestone", () => {
    expect(toggleMilestone([100], 100)).toEqual([100]);
  });

  it("does not mutate the input list", () => {
    const original = [50, 100];
    toggleMilestone(original, 25);
    expect(original).toEqual([50, 100]);
  });
});

describe("countEnabledAlerts", () => {
  it("counts every alert kind when all are on", () => {
    expect(countEnabledAlerts(ALL_ON)).toBe(5);
  });

  it("ignores the non-toggle preferences", () => {
    const noneOn: NotificationPreferences = {
      ...ALL_ON,
      billRemindersEnabled: false,
      budgetOverspendAlertsEnabled: false,
      lowBalanceAlertsEnabled: false,
      goalMilestoneAlertsEnabled: false,
      subscriptionPriceAlertsEnabled: false,
    };
    expect(countEnabledAlerts(noneOn)).toBe(0);
  });

  it("counts a partial selection", () => {
    expect(countEnabledAlerts({ ...ALL_ON, lowBalanceAlertsEnabled: false })).toBe(4);
  });
});

describe("describeEnabledAlerts", () => {
  it("summarises the enabled count", () => {
    expect(describeEnabledAlerts({ ...ALL_ON, billRemindersEnabled: false })).toBe(
      "4 of 5 alerts on"
    );
  });
});
