import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: class {
      $queryRaw = prismaMock.$queryRaw;
      $executeRaw = prismaMock.$executeRaw;
      $transaction = prismaMock.$transaction;
    },
  };
});

/**
 * Queues one result per SELECT that exportUserData issues, in the order the
 * destructured Promise.all expects them.
 */
function queueExportRows(overrides: Partial<Record<string, unknown[]>> = {}) {
  const sections = [
    "profile",
    "accounts",
    "transactions",
    "budgets",
    "savingsGoals",
    "recurringTransactions",
    "manualEntries",
    "categorizationRules",
    "netWorthSnapshots",
  ];
  for (const section of sections) {
    prismaMock.$queryRaw.mockResolvedValueOnce(overrides[section] ?? []);
  }
}

describe("userDataService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
    prismaMock.$executeRaw.mockReset();
    prismaMock.$transaction.mockReset();
  });

  describe("exportUserData", () => {
    it("returns empty collections and a null profile for a brand-new user", async () => {
      const { exportUserData, USER_DATA_EXPORT_VERSION } = await import("./userDataService");
      queueExportRows();

      const data = await exportUserData("u-1");

      expect(data.profile).toBeNull();
      expect(data.accounts).toEqual([]);
      expect(data.transactions).toEqual([]);
      expect(data.exportVersion).toBe(USER_DATA_EXPORT_VERSION);
      expect(data.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("converts Decimal columns to numbers and date-only columns to YYYY-MM-DD", async () => {
      const { exportUserData } = await import("./userDataService");
      queueExportRows({
        profile: [
          {
            firstName: "Alex",
            lastName: "Rivera",
            username: "alex",
            email: "alex@example.com",
            province: "ON",
            tfsaBirthYear: 1996,
            tfsaRoomUsedElsewhere: "1500.0000",
            rrspContributionRoom: null,
            monthlyTakeHomeIncome: "4300.0000",
            payFrequency: "MONTHLY",
            nextPayday: new Date("2026-10-01T00:00:00.000Z"),
            primaryFinancialGoal: "SAVE",
            billRemindersEnabled: true,
            billReminderLeadDays: 3,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        accounts: [{ id: "a-1", ownerName: "Alex Rivera", balance: "250.5000" }],
        transactions: [{ id: "t-1", amount: "19.9900" }],
        budgets: [{ category: "Groceries", monthlyLimit: "600.0000" }],
        savingsGoals: [{ name: "Emergency Fund", targetAmount: "10000.0000" }],
        recurringTransactions: [{ name: "Rent", amount: "1500.0000" }],
        manualEntries: [
          { name: "Car", type: "ASSET", amount: "5000.0000", date: new Date("2026-02-03") },
        ],
        netWorthSnapshots: [
          {
            month: "2026-01",
            netWorth: "1000.0000",
            totalAssets: "1200.0000",
            totalDebt: "200.0000",
            manualAssets: "0.0000",
            manualLiabilities: "0.0000",
          },
        ],
      });

      const data = await exportUserData("u-1");

      expect(data.profile).toMatchObject({
        tfsaRoomUsedElsewhere: 1500,
        rrspContributionRoom: null,
        monthlyTakeHomeIncome: 4300,
        nextPayday: "2026-10-01",
      });
      expect(data.accounts[0]?.balance).toBe(250.5);
      expect(data.transactions[0]?.amount).toBe(19.99);
      expect(data.budgets[0]?.monthlyLimit).toBe(600);
      expect(data.savingsGoals[0]?.targetAmount).toBe(10000);
      expect(data.recurringTransactions[0]?.amount).toBe(1500);
      expect(data.manualEntries[0]).toMatchObject({ amount: 5000, date: "2026-02-03" });
      expect(data.netWorthSnapshots[0]).toEqual({
        month: "2026-01",
        netWorth: 1000,
        totalAssets: 1200,
        totalDebt: 200,
        manualAssets: 0,
        manualLiabilities: 0,
      });
    });

    it("keeps a null payday and null manual-entry date null rather than coercing to a date", async () => {
      const { exportUserData } = await import("./userDataService");
      queueExportRows({
        profile: [{ nextPayday: null, tfsaRoomUsedElsewhere: null }],
        manualEntries: [{ name: "Loan", type: "LIABILITY", amount: "300.0000", date: null }],
      });

      const data = await exportUserData("u-1");

      expect(data.profile?.nextPayday).toBeNull();
      expect(data.manualEntries[0]?.date).toBeNull();
    });

    it("excludes soft-deleted rows and scopes every query to the user", async () => {
      const { exportUserData } = await import("./userDataService");
      queueExportRows();

      await exportUserData("u-1");

      const statements = prismaMock.$queryRaw.mock.calls.map((call) => String(call[0]));
      expect(statements).toHaveLength(9);
      for (const statement of statements) {
        expect(statement).toContain("userId");
      }
      // Every table that has a deletedAt column filters on it; Profile and
      // NetWorthSnapshot do not have one.
      const softDeletable = statements.filter((statement) => statement.includes("deletedAt"));
      expect(softDeletable).toHaveLength(7);
    });
  });

  describe("deleteAllUserData", () => {
    it("deletes every user-scoped table inside a single transaction", async () => {
      const { deleteAllUserData } = await import("./userDataService");
      prismaMock.$executeRaw.mockImplementation((...args: unknown[]) => String(args[0]));
      prismaMock.$transaction.mockResolvedValue([]);

      await deleteAllUserData("u-1");

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      const statements = prismaMock.$executeRaw.mock.calls.map((call) => String(call[0]));
      for (const table of [
        "Transaction",
        "SavingsGoal",
        "Notification",
        "RecurringTransaction",
        "BudgetPeriod",
        "CategoryBudget",
        "NetWorthSnapshot",
        "ManualEntry",
        "AutoCategorizationRule",
        "ActivityLog",
        "PlaidItem",
        "Account",
        "Profile",
        "CredentialUser",
      ]) {
        expect(statements.some((statement) => statement.includes(`"${table}"`))).toBe(true);
      }
    });

    it("removes the account rows before the accounts they hang off", async () => {
      const { deleteAllUserData } = await import("./userDataService");
      prismaMock.$executeRaw.mockImplementation((...args: unknown[]) => String(args[0]));
      prismaMock.$transaction.mockResolvedValue([]);

      await deleteAllUserData("u-1");

      const statements = prismaMock.$executeRaw.mock.calls.map((call) => String(call[0]));
      const transactionIndex = statements.findIndex((s) =>
        s.includes(String.raw`DELETE FROM "Transaction"`)
      );
      const accountIndex = statements.findIndex((s) =>
        s.includes(String.raw`DELETE FROM "Account"`)
      );
      expect(transactionIndex).toBeGreaterThanOrEqual(0);
      expect(transactionIndex).toBeLessThan(accountIndex);
    });
  });
});
