import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listSavingsGoals,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  restoreSavingsGoal,
  SavingsGoalInput,
} from "./savingsGoalService";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
    $executeRaw = prismaMock.$executeRaw;
  },
}));

vi.mock("./activityService", () => ({ logActivity: vi.fn() }));

type SavingsGoalRow = {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  targetAmount: number | string;
  targetDate: Date | null;
  icon: string | null;
  color: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  accountBalance: number | string;
  accountNickname: string | null;
  accountOwnerName: string;
  accountType: string;
};

/** Creates a SavingsGoalRow fixture with string-typed numeric fields (as Postgres returns them). */
function makeGoalRow(overrides?: Partial<SavingsGoalRow>): SavingsGoalRow {
  return {
    id: "g-1",
    userId: "u-1",
    accountId: "a-1",
    name: "Emergency Fund",
    targetAmount: "5000",
    targetDate: null,
    icon: null,
    color: null,
    note: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    accountBalance: "1000",
    accountNickname: null,
    accountOwnerName: "Test User",
    accountType: "SAVINGS",
    ...overrides,
  };
}

/** Creates a create/update payload fixture; override only the fields a test cares about. */
function makeGoalInput(overrides: Partial<SavingsGoalInput> = {}): SavingsGoalInput {
  return {
    accountId: "a-1",
    name: "Emergency Fund",
    targetAmount: 5000,
    targetDate: null,
    icon: null,
    color: null,
    note: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// normalizeSavingsGoalRow — tested via listSavingsGoals
// ---------------------------------------------------------------------------

describe("normalizeSavingsGoalRow", () => {
  it("coerces string targetAmount and accountBalance to numbers", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ targetAmount: "5000", accountBalance: "1000" }),
    ]);

    const [goal] = await listSavingsGoals("u-1");

    expect(typeof goal.targetAmount).toBe("number");
    expect(goal.targetAmount).toBe(5000);
    expect(typeof goal.currentBalance).toBe("number");
    expect(goal.currentBalance).toBe(1000);
  });

  it("prefers accountNickname over accountOwnerName for accountName", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ accountNickname: "My Savings", accountOwnerName: "Test User" }),
    ]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.accountName).toBe("My Savings");
  });

  it("falls back to accountOwnerName when accountNickname is null", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ accountNickname: null, accountOwnerName: "Test User" }),
    ]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.accountName).toBe("Test User");
  });

  it("computes percentageReached correctly for a partial balance", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ targetAmount: "1000", accountBalance: "250" }),
    ]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.percentageReached).toBe(25);
  });

  it("clamps percentageReached to 100 when balance exceeds target", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ targetAmount: "500", accountBalance: "9999" }),
    ]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.percentageReached).toBe(100);
  });

  it("clamps percentageReached to 0 when balance is negative", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ targetAmount: "1000", accountBalance: "-500" }),
    ]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.percentageReached).toBe(0);
  });

  it("renders the targetDate column as a YYYY-MM-DD string", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ targetDate: new Date("2027-06-30T00:00:00.000Z") }),
    ]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.targetDate).toBe("2027-06-30");
  });

  it("leaves targetDate null when the goal has no deadline", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeGoalRow({ targetDate: null })]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.targetDate).toBeNull();
  });

  it("passes the icon, colour, and note through untouched", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ icon: "🏠", color: "GREEN", note: "Down payment." }),
    ]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.icon).toBe("🏠");
    expect(goal.color).toBe("GREEN");
    expect(goal.note).toBe("Down payment.");
  });

  it("returns percentageReached of 0 when targetAmount is 0", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ targetAmount: "0", accountBalance: "500" }),
    ]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.percentageReached).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// listSavingsGoals
// ---------------------------------------------------------------------------

describe("listSavingsGoals", () => {
  it("returns an empty array when the user has no savings goals", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await listSavingsGoals("u-1");

    expect(result).toEqual([]);
  });

  it("returns a normalized goal for each row returned by the database", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([
      makeGoalRow({ id: "g-1", name: "Emergency Fund" }),
      makeGoalRow({ id: "g-2", name: "Holiday" }),
    ]);

    const result = await listSavingsGoals("u-1");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("g-1");
    expect(result[1].id).toBe("g-2");
  });
});

// ---------------------------------------------------------------------------
// createSavingsGoal
// ---------------------------------------------------------------------------

describe("createSavingsGoal", () => {
  it("throws AppError 404 when the linked account does not belong to the user", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // account check → not found

    await expect(
      createSavingsGoal("u-1", makeGoalInput({ accountId: "a-99" }))
    ).rejects.toMatchObject({ statusCode: 404, message: "Account not found" });
  });

  it("returns the newly created savings goal on success", async () => {
    const row = makeGoalRow({ name: "New Goal", targetAmount: "2000", accountBalance: "500" });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "a-1" }]) // account check
      .mockResolvedValueOnce([row]); // fetchSavingsGoalWithAccount
    prismaMock.$executeRaw.mockResolvedValueOnce(1);

    const goal = await createSavingsGoal(
      "u-1",
      makeGoalInput({ name: "New Goal", targetAmount: 2000 })
    );

    expect(goal.name).toBe("New Goal");
    expect(goal.targetAmount).toBe(2000);
    expect(goal.currentBalance).toBe(500);
  });

  it("persists the target date, icon, colour, and note alongside the core fields", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "a-1" }]) // account check
      .mockResolvedValueOnce([
        makeGoalRow({
          targetDate: new Date("2027-06-30T00:00:00.000Z"),
          icon: "✈️",
          color: "VIOLET",
          note: "Two weeks in Japan.",
        }),
      ]); // fetchSavingsGoalWithAccount
    prismaMock.$executeRaw.mockResolvedValueOnce(1);

    const goal = await createSavingsGoal(
      "u-1",
      makeGoalInput({
        targetDate: new Date("2027-06-30T00:00:00.000Z"),
        icon: "✈️",
        color: "VIOLET",
        note: "Two weeks in Japan.",
      })
    );

    const insertedValues = prismaMock.$executeRaw.mock.calls[0]!.slice(1);
    expect(insertedValues).toContain("✈️");
    expect(insertedValues).toContain("VIOLET");
    expect(insertedValues).toContain("Two weeks in Japan.");
    expect(goal.targetDate).toBe("2027-06-30");
    expect(goal.icon).toBe("✈️");
    expect(goal.color).toBe("VIOLET");
    expect(goal.note).toBe("Two weeks in Japan.");
  });
});

// ---------------------------------------------------------------------------
// updateSavingsGoal
// ---------------------------------------------------------------------------

describe("updateSavingsGoal", () => {
  it("throws AppError 404 when the goal does not belong to the user", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // getSavingsGoalOrThrow → not found

    await expect(updateSavingsGoal("u-1", "g-99", makeGoalInput())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws AppError 404 when the new account does not belong to the user", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "g-1" }]) // getSavingsGoalOrThrow → found
      .mockResolvedValueOnce([makeGoalRow()]) // fetchSavingsGoalWithAccount (before-state for the diff)
      .mockResolvedValueOnce([]); // account check → not found

    await expect(
      updateSavingsGoal("u-1", "g-1", makeGoalInput({ accountId: "a-99" }))
    ).rejects.toMatchObject({ statusCode: 404, message: "Account not found" });
  });

  it("returns the updated savings goal on success", async () => {
    const row = makeGoalRow({ name: "Updated Goal", targetAmount: "3000", accountBalance: "1500" });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "g-1" }]) // getSavingsGoalOrThrow
      .mockResolvedValueOnce([makeGoalRow()]) // fetchSavingsGoalWithAccount (before-state for the diff)
      .mockResolvedValueOnce([{ id: "a-1" }]) // account check
      .mockResolvedValueOnce([row]); // fetchSavingsGoalWithAccount (after update)
    prismaMock.$executeRaw.mockResolvedValueOnce(1);

    const goal = await updateSavingsGoal(
      "u-1",
      "g-1",
      makeGoalInput({ name: "Updated Goal", targetAmount: 3000 })
    );

    expect(goal.name).toBe("Updated Goal");
    expect(goal.targetAmount).toBe(3000);
    expect(goal.currentBalance).toBe(1500);
  });

  it("clears the target date, icon, colour, and note when they are passed as null", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "g-1" }]) // getSavingsGoalOrThrow
      .mockResolvedValueOnce([
        makeGoalRow({
          targetDate: new Date("2027-06-30T00:00:00.000Z"),
          icon: "✈️",
          color: "VIOLET",
          note: "Two weeks in Japan.",
        }),
      ]) // fetchSavingsGoalWithAccount (before-state for the diff)
      .mockResolvedValueOnce([{ id: "a-1" }]) // account check
      .mockResolvedValueOnce([makeGoalRow()]); // fetchSavingsGoalWithAccount (after update)
    prismaMock.$executeRaw.mockResolvedValueOnce(1);

    const goal = await updateSavingsGoal("u-1", "g-1", makeGoalInput());

    expect(goal.targetDate).toBeNull();
    expect(goal.icon).toBeNull();
    expect(goal.color).toBeNull();
    expect(goal.note).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteSavingsGoal
// ---------------------------------------------------------------------------

describe("deleteSavingsGoal", () => {
  it("throws AppError 404 when the goal does not belong to the user", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([]) // fetchSavingsGoalWithAccount → null
      .mockResolvedValueOnce([]); // DELETE RETURNING → no rows → 404

    await expect(deleteSavingsGoal("u-1", "g-99")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("resolves without error when the goal is deleted successfully", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeGoalRow()]) // fetchSavingsGoalWithAccount
      .mockResolvedValueOnce([{ id: "g-1" }]); // UPDATE ... SET deletedAt RETURNING → found

    await expect(deleteSavingsGoal("u-1", "g-1")).resolves.toBeUndefined();
  });
});

describe("restoreSavingsGoal", () => {
  it("throws AppError 404 when there is no soft-deleted goal to restore", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // UPDATE ... SET deletedAt = NULL RETURNING → none

    await expect(restoreSavingsGoal("u-1", "g-99")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("clears deletedAt and returns the goal with its account data", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "g-1" }]) // UPDATE RETURNING → restored
      .mockResolvedValueOnce([makeGoalRow()]); // fetchSavingsGoalWithAccount

    const goal = await restoreSavingsGoal("u-1", "g-1");
    expect(goal).toMatchObject({ id: "g-1" });
  });
});
