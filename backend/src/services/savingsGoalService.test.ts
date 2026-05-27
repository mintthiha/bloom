import { beforeEach, describe, expect, it, vi } from "vitest";
import { listSavingsGoals, createSavingsGoal, updateSavingsGoal, deleteSavingsGoal } from "./savingsGoalService";
import { AppError } from "../middleware/errorHandler";

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

type SavingsGoalRow = {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  targetAmount: number | string;
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
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    accountBalance: "1000",
    accountNickname: null,
    accountOwnerName: "Test User",
    accountType: "SAVINGS",
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
    prismaMock.$queryRaw.mockResolvedValueOnce([makeGoalRow({ targetAmount: "5000", accountBalance: "1000" })]);

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
    prismaMock.$queryRaw.mockResolvedValueOnce([makeGoalRow({ targetAmount: "1000", accountBalance: "250" })]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.percentageReached).toBe(25);
  });

  it("clamps percentageReached to 100 when balance exceeds target", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeGoalRow({ targetAmount: "500", accountBalance: "9999" })]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.percentageReached).toBe(100);
  });

  it("clamps percentageReached to 0 when balance is negative", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeGoalRow({ targetAmount: "1000", accountBalance: "-500" })]);

    const [goal] = await listSavingsGoals("u-1");

    expect(goal.percentageReached).toBe(0);
  });

  it("returns percentageReached of 0 when targetAmount is 0", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeGoalRow({ targetAmount: "0", accountBalance: "500" })]);

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
      createSavingsGoal("u-1", { accountId: "a-99", name: "Goal", targetAmount: 1000 })
    ).rejects.toMatchObject({ statusCode: 404, message: "Account not found" });
  });

  it("returns the newly created savings goal on success", async () => {
    const row = makeGoalRow({ name: "New Goal", targetAmount: "2000", accountBalance: "500" });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "a-1" }]) // account check
      .mockResolvedValueOnce([row]);            // fetchSavingsGoalWithAccount
    prismaMock.$executeRaw.mockResolvedValueOnce(1);

    const goal = await createSavingsGoal("u-1", { accountId: "a-1", name: "New Goal", targetAmount: 2000 });

    expect(goal.name).toBe("New Goal");
    expect(goal.targetAmount).toBe(2000);
    expect(goal.currentBalance).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// updateSavingsGoal
// ---------------------------------------------------------------------------

describe("updateSavingsGoal", () => {
  it("throws AppError 404 when the goal does not belong to the user", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // getSavingsGoalOrThrow → not found

    await expect(
      updateSavingsGoal("u-1", "g-99", { accountId: "a-1", name: "Goal", targetAmount: 1000 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws AppError 404 when the new account does not belong to the user", async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "g-1" }]) // getSavingsGoalOrThrow → found
      .mockResolvedValueOnce([]);              // account check → not found

    await expect(
      updateSavingsGoal("u-1", "g-1", { accountId: "a-99", name: "Goal", targetAmount: 1000 })
    ).rejects.toMatchObject({ statusCode: 404, message: "Account not found" });
  });

  it("returns the updated savings goal on success", async () => {
    const row = makeGoalRow({ name: "Updated Goal", targetAmount: "3000", accountBalance: "1500" });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: "g-1" }]) // getSavingsGoalOrThrow
      .mockResolvedValueOnce([{ id: "a-1" }]) // account check
      .mockResolvedValueOnce([row]);           // fetchSavingsGoalWithAccount
    prismaMock.$executeRaw.mockResolvedValueOnce(1);

    const goal = await updateSavingsGoal("u-1", "g-1", { accountId: "a-1", name: "Updated Goal", targetAmount: 3000 });

    expect(goal.name).toBe("Updated Goal");
    expect(goal.targetAmount).toBe(3000);
    expect(goal.currentBalance).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// deleteSavingsGoal
// ---------------------------------------------------------------------------

describe("deleteSavingsGoal", () => {
  it("throws AppError 404 when the goal does not belong to the user", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // DELETE RETURNING → no rows

    await expect(deleteSavingsGoal("u-1", "g-99")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("resolves without error when the goal is deleted successfully", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "g-1" }]);

    await expect(deleteSavingsGoal("u-1", "g-1")).resolves.toBeUndefined();
  });
});
