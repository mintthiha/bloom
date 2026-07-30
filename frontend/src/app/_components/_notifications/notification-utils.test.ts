import { describe, expect, it } from "vitest";
import { classifyReminderUrgency, daysUntil, formatDueLabel } from "./notification-utils";

const TODAY = "2026-07-28";

describe("daysUntil", () => {
  it("returns 0 for today and positive/negative for future/past", () => {
    expect(daysUntil("2026-07-28", TODAY)).toBe(0);
    expect(daysUntil("2026-07-31", TODAY)).toBe(3);
    expect(daysUntil("2026-07-26", TODAY)).toBe(-2);
  });
});

describe("classifyReminderUrgency", () => {
  it("flags past dates as overdue", () => {
    expect(classifyReminderUrgency("2026-07-27", TODAY)).toBe("overdue");
  });

  it("flags today through the 7-day window as due-soon", () => {
    expect(classifyReminderUrgency("2026-07-28", TODAY)).toBe("due-soon");
    expect(classifyReminderUrgency("2026-08-04", TODAY)).toBe("due-soon");
  });

  it("flags dates past the window as upcoming", () => {
    expect(classifyReminderUrgency("2026-08-05", TODAY)).toBe("upcoming");
  });

  it("treats a null due date as upcoming", () => {
    expect(classifyReminderUrgency(null, TODAY)).toBe("upcoming");
  });
});

describe("formatDueLabel", () => {
  it("formats today, tomorrow, future and overdue cases", () => {
    expect(formatDueLabel("2026-07-28", TODAY)).toBe("Due today");
    expect(formatDueLabel("2026-07-29", TODAY)).toBe("Due tomorrow");
    expect(formatDueLabel("2026-07-31", TODAY)).toBe("Due in 3 days");
    expect(formatDueLabel("2026-07-27", TODAY)).toBe("1 day overdue");
    expect(formatDueLabel("2026-07-25", TODAY)).toBe("3 days overdue");
  });

  it("returns an empty string when there is no due date", () => {
    expect(formatDueLabel(null, TODAY)).toBe("");
  });
});
