import { describe, expect, it } from "vitest";
import { AppNotification } from "@/lib/api";
import {
  classifyReminderUrgency,
  daysUntil,
  formatDueLabel,
  groupNotifications,
} from "./notification-utils";

const TODAY = "2026-07-28";

/** Builds a notification with sensible defaults for grouping tests. */
function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n",
    kind: "BILL_REMINDER",
    recurringTransactionId: null,
    title: "Title",
    body: "Body",
    dueDate: null,
    linkHref: null,
    status: "UNREAD",
    createdAt: "2026-07-28T00:00:00.000Z",
    readAt: null,
    ...overrides,
  };
}

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

describe("groupNotifications", () => {
  it("buckets by urgency and dateless alerts, in order, omitting empty sections", () => {
    const groups = groupNotifications(
      [
        makeNotification({ id: "upcoming", dueDate: "2026-08-20" }),
        makeNotification({ id: "alert", kind: "LOW_BALANCE", dueDate: null }),
        makeNotification({ id: "overdue", dueDate: "2026-07-27" }),
        makeNotification({ id: "due-soon", dueDate: "2026-07-30" }),
      ],
      TODAY
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Overdue",
      "Due soon",
      "Upcoming",
      "Alerts",
    ]);
    expect(groups.map((group) => group.items[0].id)).toEqual([
      "overdue",
      "due-soon",
      "upcoming",
      "alert",
    ]);
  });

  it("omits sections with no items", () => {
    const groups = groupNotifications(
      [makeNotification({ id: "a", kind: "GOAL_REACHED", dueDate: null })],
      TODAY
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Alerts");
  });
});
