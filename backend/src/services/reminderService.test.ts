import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
  },
}));

describe("reminderService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
  });

  it("skips generation when the user has no profile", async () => {
    const { generateBillReminders } = await import("./reminderService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await generateBillReminders("user-1");

    expect(result).toEqual({ createdCount: 0 });
    // Only the preferences lookup should have run — no rule scan, no inserts.
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("skips generation when reminders are disabled", async () => {
    const { generateBillReminders } = await import("./reminderService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { billRemindersEnabled: false, billReminderLeadDays: 3 },
    ]);

    const result = await generateBillReminders("user-1");

    expect(result).toEqual({ createdCount: 0 });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("inserts one reminder per due rule and counts only newly created rows", async () => {
    const { generateBillReminders } = await import("./reminderService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ billRemindersEnabled: true, billReminderLeadDays: 3 }])
      .mockResolvedValueOnce([
        {
          id: "rule-1",
          name: "Rent",
          merchant: null,
          amount: "1200.0000",
          nextRunAt: new Date("2026-07-30T00:00:00.000Z"),
        },
        {
          id: "rule-2",
          name: "Hydro",
          merchant: "BC Hydro",
          amount: "85.5000",
          nextRunAt: new Date("2026-07-29T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([{ id: "notif-1" }]) // rule-1 inserted
      .mockResolvedValueOnce([]); // rule-2 already existed (deduped)

    const result = await generateBillReminders("user-1");

    expect(result).toEqual({ createdCount: 1 });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(4);
  });

  it("lists non-dismissed notifications with an unread count", async () => {
    const { listNotifications } = await import("./reminderService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        id: "notif-1",
        userId: "user-1",
        kind: "BILL_REMINDER",
        recurringTransactionId: "rule-1",
        title: "Rent",
        body: "Payment of $1200.00 is due",
        dueDate: new Date("2026-07-30T00:00:00.000Z"),
        status: "UNREAD",
        createdAt: new Date("2026-07-28T12:00:00.000Z"),
        readAt: null,
      },
      {
        id: "notif-2",
        userId: "user-1",
        kind: "BILL_REMINDER",
        recurringTransactionId: "rule-2",
        title: "BC Hydro",
        body: "Payment of $85.50 is due",
        dueDate: new Date("2026-08-01T00:00:00.000Z"),
        status: "READ",
        createdAt: new Date("2026-07-28T12:00:00.000Z"),
        readAt: new Date("2026-07-28T13:00:00.000Z"),
      },
    ]);

    const result = await listNotifications("user-1");

    expect(result.unreadCount).toBe(1);
    expect(result.notifications[0]).toMatchObject({
      id: "notif-1",
      dueDate: "2026-07-30",
      status: "UNREAD",
      readAt: null,
    });
    expect(result.notifications[1]).toMatchObject({
      id: "notif-2",
      dueDate: "2026-08-01",
      readAt: "2026-07-28T13:00:00.000Z",
    });
  });

  it("throws 404 when marking a notification that does not exist", async () => {
    const { markNotificationRead } = await import("./reminderService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(markNotificationRead("user-1", "missing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("returns the updated row when marking a notification read", async () => {
    const { markNotificationRead } = await import("./reminderService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        id: "notif-1",
        userId: "user-1",
        kind: "BILL_REMINDER",
        recurringTransactionId: "rule-1",
        title: "Rent",
        body: "Payment of $1200.00 is due",
        dueDate: new Date("2026-07-30T00:00:00.000Z"),
        status: "READ",
        createdAt: new Date("2026-07-28T12:00:00.000Z"),
        readAt: new Date("2026-07-28T13:00:00.000Z"),
      },
    ]);

    const result = await markNotificationRead("user-1", "notif-1");

    expect(result).toMatchObject({ id: "notif-1", status: "READ", dueDate: "2026-07-30" });
  });

  it("throws 404 when dismissing a notification that does not exist", async () => {
    const { dismissNotification } = await import("./reminderService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(dismissNotification("user-1", "missing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
