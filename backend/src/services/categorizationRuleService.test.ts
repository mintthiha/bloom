import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  listRules,
  upsertRule,
  updateRule,
  deleteRule,
  restoreRule,
} from "./categorizationRuleService";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    autoCategorizationRule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: class {
      autoCategorizationRule = prismaMock.autoCategorizationRule;
    },
  };
});

type Rule = {
  id: string;
  userId: string;
  merchant: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** Builds a categorization rule fixture. */
function makeRule(overrides?: Partial<Rule>): Rule {
  return {
    id: "r-1",
    userId: "u-1",
    merchant: "Metro",
    category: "Food",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedAt: null,
    ...overrides,
  };
}

/** Builds a Prisma unique-constraint (P2002) error, as thrown on a duplicate merchant. */
function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listRules", () => {
  it("returns the user's live rules ordered by merchant", async () => {
    const rules = [makeRule({ id: "r-1" }), makeRule({ id: "r-2" })];
    prismaMock.autoCategorizationRule.findMany.mockResolvedValueOnce(rules);

    const result = await listRules("u-1");

    expect(result).toBe(rules);
    expect(prismaMock.autoCategorizationRule.findMany).toHaveBeenCalledWith({
      where: { userId: "u-1", deletedAt: null },
      orderBy: { merchant: "asc" },
    });
  });
});

describe("upsertRule", () => {
  it("creates a new rule when none exists for the merchant", async () => {
    const rule = makeRule({ merchant: "Metro", category: "Groceries" });
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(null);
    prismaMock.autoCategorizationRule.create.mockResolvedValueOnce(rule);

    const result = await upsertRule("u-1", "Metro", "Groceries");

    expect(result).toBe(rule);
    expect(prismaMock.autoCategorizationRule.create).toHaveBeenCalledWith({
      data: { userId: "u-1", merchant: "Metro", category: "Groceries" },
    });
  });

  it("revives and re-points a soft-deleted rule for the same merchant", async () => {
    const existing = makeRule({ deletedAt: new Date("2026-02-02") });
    const updated = makeRule({ category: "Groceries" });
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(existing);
    prismaMock.autoCategorizationRule.update.mockResolvedValueOnce(updated);

    const result = await upsertRule("u-1", "Metro", "Groceries");

    expect(result).toBe(updated);
    expect(prismaMock.autoCategorizationRule.update).toHaveBeenCalledWith({
      where: { id: "r-1" },
      data: { category: "Groceries", deletedAt: null },
    });
    expect(prismaMock.autoCategorizationRule.create).not.toHaveBeenCalled();
  });
});

describe("updateRule", () => {
  it("throws AppError 404 when the rule does not belong to the user", async () => {
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(null);

    await expect(updateRule("u-1", "r-99", "Metro", "Food")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(prismaMock.autoCategorizationRule.update).not.toHaveBeenCalled();
  });

  it("returns the updated rule on success", async () => {
    const updated = makeRule({ merchant: "Loblaws", category: "Food" });
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(makeRule());
    prismaMock.autoCategorizationRule.update.mockResolvedValueOnce(updated);

    const result = await updateRule("u-1", "r-1", "Loblaws", "Food");

    expect(result).toBe(updated);
  });

  it("translates a P2002 unique violation into AppError 409", async () => {
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(makeRule());
    prismaMock.autoCategorizationRule.update.mockRejectedValueOnce(uniqueConstraintError());

    await expect(updateRule("u-1", "r-1", "Metro", "Food")).rejects.toMatchObject({
      statusCode: 409,
      message: 'A rule for "Metro" already exists',
    });
  });

  it("rethrows non-P2002 errors unchanged", async () => {
    const boom = new Error("db down");
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(makeRule());
    prismaMock.autoCategorizationRule.update.mockRejectedValueOnce(boom);

    await expect(updateRule("u-1", "r-1", "Metro", "Food")).rejects.toBe(boom);
  });
});

describe("deleteRule", () => {
  it("throws AppError 404 when the rule does not belong to the user", async () => {
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(null);

    await expect(deleteRule("u-1", "r-99")).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.autoCategorizationRule.update).not.toHaveBeenCalled();
  });

  it("soft-deletes the rule when it belongs to the user", async () => {
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(makeRule());
    prismaMock.autoCategorizationRule.update.mockResolvedValueOnce(makeRule());

    await expect(deleteRule("u-1", "r-1")).resolves.toBeUndefined();
    expect(prismaMock.autoCategorizationRule.update).toHaveBeenCalledWith({
      where: { id: "r-1" },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("restoreRule", () => {
  it("throws AppError 404 when the rule is not currently soft-deleted", async () => {
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(
      makeRule({ deletedAt: null })
    );

    await expect(restoreRule("u-1", "r-1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws AppError 409 when a live rule for the merchant now exists", async () => {
    prismaMock.autoCategorizationRule.findFirst
      .mockResolvedValueOnce(makeRule({ deletedAt: new Date("2026-02-02") }))
      .mockResolvedValueOnce(makeRule({ id: "r-2" }));

    await expect(restoreRule("u-1", "r-1")).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.autoCategorizationRule.update).not.toHaveBeenCalled();
  });

  it("clears deletedAt when no live rule for the merchant exists", async () => {
    const restored = makeRule();
    prismaMock.autoCategorizationRule.findFirst
      .mockResolvedValueOnce(makeRule({ deletedAt: new Date("2026-02-02") }))
      .mockResolvedValueOnce(null);
    prismaMock.autoCategorizationRule.update.mockResolvedValueOnce(restored);

    await expect(restoreRule("u-1", "r-1")).resolves.toBe(restored);
    expect(prismaMock.autoCategorizationRule.update).toHaveBeenCalledWith({
      where: { id: "r-1" },
      data: { deletedAt: null },
    });
  });
});
