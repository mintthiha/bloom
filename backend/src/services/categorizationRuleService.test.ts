import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { listRules, upsertRule, updateRule, deleteRule } from "./categorizationRuleService";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    autoCategorizationRule: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      findFirst: vi.fn(),
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
  it("returns the user's rules ordered by merchant", async () => {
    const rules = [makeRule({ id: "r-1" }), makeRule({ id: "r-2" })];
    prismaMock.autoCategorizationRule.findMany.mockResolvedValueOnce(rules);

    const result = await listRules("u-1");

    expect(result).toBe(rules);
    expect(prismaMock.autoCategorizationRule.findMany).toHaveBeenCalledWith({
      where: { userId: "u-1" },
      orderBy: { merchant: "asc" },
    });
  });
});

describe("upsertRule", () => {
  it("upserts on the user+merchant unique key and returns the rule", async () => {
    const rule = makeRule({ merchant: "Metro", category: "Groceries" });
    prismaMock.autoCategorizationRule.upsert.mockResolvedValueOnce(rule);

    const result = await upsertRule("u-1", "Metro", "Groceries");

    expect(result).toBe(rule);
    expect(prismaMock.autoCategorizationRule.upsert).toHaveBeenCalledWith({
      where: { userId_merchant: { userId: "u-1", merchant: "Metro" } },
      update: { category: "Groceries" },
      create: { userId: "u-1", merchant: "Metro", category: "Groceries" },
    });
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
    expect(prismaMock.autoCategorizationRule.delete).not.toHaveBeenCalled();
  });

  it("deletes the rule when it belongs to the user", async () => {
    prismaMock.autoCategorizationRule.findFirst.mockResolvedValueOnce(makeRule());
    prismaMock.autoCategorizationRule.delete.mockResolvedValueOnce(makeRule());

    await expect(deleteRule("u-1", "r-1")).resolves.toBeUndefined();
    expect(prismaMock.autoCategorizationRule.delete).toHaveBeenCalledWith({ where: { id: "r-1" } });
  });
});
