import { randomUUID } from "crypto";
import prisma from "../lib/prisma";
import logger from "../lib/logger";

export type ActivityType =
  | "ACCOUNT_CREATED"
  | "ACCOUNT_DELETED"
  | "ACCOUNT_FROZEN"
  | "ACCOUNT_UNFROZEN"
  | "ACCOUNT_RENAMED"
  | "TRANSACTION_DEPOSIT"
  | "TRANSACTION_WITHDRAWAL"
  | "TRANSACTION_TRANSFER"
  | "TRANSACTION_DELETED"
  | "TRANSACTION_UPDATED"
  | "TRANSACTION_IMPORTED"
  | "GOAL_CREATED"
  | "GOAL_UPDATED"
  | "GOAL_DELETED"
  | "BUDGET_CREATED"
  | "BUDGET_UPDATED"
  | "BUDGET_DELETED"
  | "RECURRING_CREATED"
  | "RECURRING_DELETED";

export type ActivityLogEntry = {
  id: string;
  type: string;
  description: string;
  metadata: unknown;
  createdAt: Date;
};

/** Appends an activity log entry for the user. Fire-and-forget — never blocks the caller. */
export function logActivity(
  userId: string,
  type: ActivityType,
  description: string,
  metadata?: Record<string, unknown>
): void {
  const id = randomUUID();
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  prisma.$executeRaw`
    INSERT INTO "ActivityLog" ("id", "userId", "type", "description", "metadata", "createdAt")
    VALUES (${id}, ${userId}, ${type}, ${description}, ${metadataJson}::jsonb, CURRENT_TIMESTAMP)
  `.catch((err: unknown) => logger.error({ err }, "Failed to write activity log"));
}

/** Returns paginated activity log entries for a user, newest first. */
export async function listActivityLogs(
  userId: string,
  limit: number,
  offset: number
): Promise<{ logs: ActivityLogEntry[]; total: number }> {
  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<ActivityLogEntry[]>`
      SELECT "id", "type", "description", "metadata", "createdAt"
      FROM "ActivityLog"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "ActivityLog" WHERE "userId" = ${userId}
    `,
  ]);
  return { logs: rows, total: Number(countRows[0]?.count ?? 0) };
}
