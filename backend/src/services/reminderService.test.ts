import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, accountMock, budgetMock, goalMock, subscriptionMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
  accountMock: { listAccounts: vi.fn() },
  budgetMock: { listBudgets: vi.fn() },
  goalMock: { listSavingsGoals: vi.fn() },
  subscriptionMock: { getSubscriptionSummary: vi.fn() },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
  },
}));

vi.mock("./accountService", () => accountMock);
vi.mock("./budgetService", () => budgetMock);
vi.mock("./savingsGoalService", () => goalMock);
vi.mock("./subscriptionService", () => subscriptionMock);

describe("reminderService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
    accountMock.listAccounts.mockReset();
    budgetMock.listBudgets.mockReset();
    goalMock.listSavingsGoals.mockReset();
    subscriptionMock.getSubscriptionSummary.mockReset();
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

  it("alerts only for non-frozen cash accounts below the low-balance threshold", async () => {
    const { generateLowBalanceAlerts } = await import("./reminderService");
    accountMock.listAccounts.mockResolvedValue([
      {
        id: "a1",
        nickname: "Everyday",
        ownerName: "Me",
        accountType: "CHEQUING",
        balance: 40,
        frozen: false,
      },
      {
        id: "a2",
        nickname: "Savings",
        ownerName: "Me",
        accountType: "SAVINGS",
        balance: 5000,
        frozen: false,
      },
      {
        id: "a3",
        nickname: "Visa",
        ownerName: "Me",
        accountType: "CREDIT",
        balance: 12,
        frozen: false,
      },
      {
        id: "a4",
        nickname: "Locked",
        ownerName: "Me",
        accountType: "CHEQUING",
        balance: 5,
        frozen: true,
      },
    ]);
    // Only a1 qualifies, so createNotification runs once.
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "notif-a1" }]);

    const result = await generateLowBalanceAlerts("user-1");

    expect(result).toEqual({ createdCount: 1 });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("alerts for budgets that are over their limit", async () => {
    const { generateBudgetOverspendAlerts } = await import("./reminderService");
    budgetMock.listBudgets.mockResolvedValue([
      { id: "b1", category: "Groceries", month: "2026-07", remaining: -45, isOverBudget: true },
      { id: "b2", category: "Transit", month: "2026-07", remaining: 20, isOverBudget: false },
    ]);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "notif-b1" }]);

    const result = await generateBudgetOverspendAlerts("user-1");

    expect(result).toEqual({ createdCount: 1 });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("alerts for goals that reached 100%", async () => {
    const { generateGoalReachedAlerts } = await import("./reminderService");
    goalMock.listSavingsGoals.mockResolvedValue([
      { id: "g1", name: "Emergency fund", percentageReached: 100 },
      { id: "g2", name: "Vacation", percentageReached: 60 },
    ]);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "notif-g1" }]);

    const result = await generateGoalReachedAlerts("user-1");

    expect(result).toEqual({ createdCount: 1 });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("alerts only for subscriptions whose price increased", async () => {
    const { generateSubscriptionPriceAlerts } = await import("./reminderService");
    subscriptionMock.getSubscriptionSummary.mockResolvedValue({
      subscriptions: [
        { merchant: "Netflix", priceChange: { from: 16.49, to: 18.99, pct: 15 } },
        { merchant: "Spotify", priceChange: null },
        { merchant: "Gym", priceChange: { from: 50, to: 45, pct: -10 } },
      ],
    });
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "notif-netflix" }]);

    const result = await generateSubscriptionPriceAlerts("user-1");

    expect(result).toEqual({ createdCount: 1 });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("sums all generators and survives one generator throwing", async () => {
    const { generateNotifications } = await import("./reminderService");
    // Bills: no profile -> 0 (one preferences lookup).
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    accountMock.listAccounts.mockResolvedValue([
      {
        id: "a1",
        nickname: "Everyday",
        ownerName: "Me",
        accountType: "CHEQUING",
        balance: 10,
        frozen: false,
      },
    ]);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "notif-a1" }]); // low-balance insert
    budgetMock.listBudgets.mockRejectedValue(new Error("boom")); // isolated failure
    goalMock.listSavingsGoals.mockResolvedValue([]);
    subscriptionMock.getSubscriptionSummary.mockResolvedValue({ subscriptions: [] });

    const result = await generateNotifications("user-1");

    expect(result).toEqual({ createdCount: 1 });
  });

  it("marks all unread notifications read and returns the updated count", async () => {
    const { markAllNotificationsRead } = await import("./reminderService");
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "notif-1" }, { id: "notif-2" }]);

    const result = await markAllNotificationsRead("user-1");

    expect(result).toEqual({ updated: 2 });
  });

  it("returns updated 0 when no unread notifications exist", async () => {
    const { markAllNotificationsRead } = await import("./reminderService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await markAllNotificationsRead("user-1");

    expect(result).toEqual({ updated: 0 });
  });

  it("resolves when dismissing a notification that exists", async () => {
    const { dismissNotification } = await import("./reminderService");
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "notif-1" }]);

    await expect(dismissNotification("user-1", "notif-1")).resolves.toBeUndefined();
  });
});
