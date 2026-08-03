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

/** Returns all auto-categorization rules for the user, ordered by merchant name. */
export async function listRules(userId: string): Promise<CategorizationRule[]> {
  return prisma.autoCategorizationRule.findMany({
    where: { userId },
    orderBy: { merchant: "asc" },
  });
}

/** Creates or updates the categorization rule for a given merchant (unique per user+merchant). */
export async function upsertRule(
  userId: string,
  merchant: string,
  category: string
): Promise<CategorizationRule> {
  return prisma.autoCategorizationRule.upsert({
    where: { userId_merchant: { userId, merchant } },
    update: { category },
    create: { userId, merchant, category },
  });
}

/** Deletes a rule by id, throwing 404 if the rule does not belong to the user. */
export async function deleteRule(userId: string, id: string): Promise<void> {
  const rule = await prisma.autoCategorizationRule.findFirst({ where: { id, userId } });
  if (!rule) throw new AppError(404, "Rule not found");
  await prisma.autoCategorizationRule.delete({ where: { id } });
}
