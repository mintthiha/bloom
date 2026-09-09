import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";

export type CategorizationRule = {
  id: string;
  userId: string;
  merchant: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Returns all live (non-soft-deleted) auto-categorization rules for the user, ordered by merchant name. */
export async function listRules(userId: string): Promise<CategorizationRule[]> {
  return prisma.autoCategorizationRule.findMany({
    where: { userId, deletedAt: null },
    orderBy: { merchant: "asc" },
  });
}

/**
 * Creates or updates the categorization rule for a given merchant (unique per user+merchant).
 * If a soft-deleted rule exists for the merchant it is revived and re-pointed at `category`.
 */
export async function upsertRule(
  userId: string,
  merchant: string,
  category: string
): Promise<CategorizationRule> {
  const existing = await prisma.autoCategorizationRule.findFirst({
    where: { userId, merchant },
  });
  if (existing) {
    return prisma.autoCategorizationRule.update({
      where: { id: existing.id },
      data: { category, deletedAt: null },
    });
  }
  return prisma.autoCategorizationRule.create({ data: { userId, merchant, category } });
}

/**
 * Updates the merchant name and/or category of a rule by id.
 * Throws 404 if the rule does not belong to the user (or is soft-deleted), or 409 if the
 * new merchant name conflicts with another existing live rule for the same user.
 */
export async function updateRule(
  userId: string,
  id: string,
  merchant: string,
  category: string
): Promise<CategorizationRule> {
  const existing = await prisma.autoCategorizationRule.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!existing) throw new AppError(404, "Rule not found");
  try {
    return await prisma.autoCategorizationRule.update({
      where: { id },
      data: { merchant, category },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(409, `A rule for "${merchant}" already exists`);
    }
    throw err;
  }
}

/** Soft-deletes a rule by id (recoverable via restoreRule), throwing 404 if not found or already deleted. */
export async function deleteRule(userId: string, id: string): Promise<void> {
  const rule = await prisma.autoCategorizationRule.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!rule) throw new AppError(404, "Rule not found");
  await prisma.autoCategorizationRule.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/**
 * Restores a soft-deleted rule (the "Undo" action after a delete).
 * Throws 404 if the rule does not exist or is not currently deleted, or 409 if a live rule
 * for the same merchant was created in the meantime.
 */
export async function restoreRule(userId: string, id: string): Promise<CategorizationRule> {
  const rule = await prisma.autoCategorizationRule.findFirst({ where: { id, userId } });
  if (!rule || rule.deletedAt === null) throw new AppError(404, "Rule not found");
  const clash = await prisma.autoCategorizationRule.findFirst({
    where: { userId, merchant: rule.merchant, deletedAt: null },
  });
  if (clash) throw new AppError(409, `A rule for "${rule.merchant}" already exists`);
  return prisma.autoCategorizationRule.update({
    where: { id },
    data: { deletedAt: null },
  });
}
