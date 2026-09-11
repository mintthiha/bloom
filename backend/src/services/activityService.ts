import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import logger from "../lib/logger";

export type ActivityType =
  | "ACCOUNT_CREATED"
  | "ACCOUNT_DELETED"
  | "ACCOUNT_RESTORED"
  | "ACCOUNT_FROZEN"
  | "ACCOUNT_UNFROZEN"
  | "ACCOUNT_RENAMED"
  | "ACCOUNT_RESYNCED"
  | "TRANSACTION_DEPOSIT"
  | "TRANSACTION_WITHDRAWAL"
  | "TRANSACTION_TRANSFER"
  | "TRANSACTION_DELETED"
  | "TRANSACTION_RESTORED"
  | "TRANSACTION_UPDATED"
  | "TRANSACTION_IMPORTED"
  | "GOAL_CREATED"
  | "GOAL_UPDATED"
  | "GOAL_DELETED"
  | "GOAL_RESTORED"
  | "BUDGET_CREATED"
  | "BUDGET_UPDATED"
  | "BUDGET_DELETED"
  | "BUDGET_RESTORED"
  | "RECURRING_CREATED"
  | "RECURRING_UPDATED"
  | "RECURRING_PAUSED"
  | "RECURRING_RESUMED"
  | "RECURRING_DELETED"
  | "RECURRING_RESTORED"
  | "MANUAL_ENTRY_CREATED"
  | "MANUAL_ENTRY_UPDATED"
  | "MANUAL_ENTRY_DELETED"
  | "MANUAL_ENTRY_RESTORED";

export type ActivityLogEntry = {
  id: string;
  type: string;
  description: string;
  metadata: unknown;
  createdAt: Date;
};

export type { ActivityFieldChange, ActivityFieldChangeKind } from "./activityChanges";
export { describeActivityFieldChanges, pushActivityFieldChange } from "./activityChanges";

/** Coarse groupings the activity list can filter by; each maps to a `TYPE_` prefix. */
export type ActivityGroup =
  | "ACCOUNT"
  | "TRANSACTION"
  | "GOAL"
  | "BUDGET"
  | "RECURRING"
  | "MANUAL_ENTRY";

/**
 * Lifecycle action the activity list can filter by; each maps to a `_ACTION` type suffix.
 * Every logged type ends in one of these except the standalone events (import, freeze,
 * unfreeze, rename, deposit, withdrawal, transfer), which match no action.
 */
export type ActivityAction = "CREATED" | "UPDATED" | "DELETED" | "RESTORED" | "RESYNCED";

/** Sort orders the activity list accepts, mapped to a whitelisted ORDER BY clause. */
export type ActivitySortKey = "date_desc" | "date_asc";

/** Filters and paging options for {@link listActivityLogs}. */
export type ActivityLogFilters = {
  search?: string;
  group?: ActivityGroup;
  action?: ActivityAction;
  start?: Date;
  end?: Date;
  sort?: ActivitySortKey;
  limit?: number;
  offset?: number;
};

/** Paginated response: the current page of entries plus the total count for the active filter. */
export type ActivityLogListResult = {
  logs: ActivityLogEntry[];
  total: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Maps each sort key to a safe, static ORDER BY fragment (never interpolates user input). */
const ORDER_BY_BY_SORT: Record<ActivitySortKey, Prisma.Sql> = {
  date_desc: Prisma.sql`"createdAt" DESC`,
  date_asc: Prisma.sql`"createdAt" ASC`,
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

/**
 * Returns a paginated page of activity log entries for a user, with optional filtering by
 * coarse group, lifecycle action, free-text search over the description, and a created-at
 * date range.
 */
export async function listActivityLogs(
  userId: string,
  filters: ActivityLogFilters = {}
): Promise<ActivityLogListResult> {
  const limit = Math.min(Math.max(1, Math.floor(filters.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
  const offset = Math.max(0, Math.floor(filters.offset ?? 0));
  const sort = filters.sort ?? "date_desc";

  const conditions: Prisma.Sql[] = [Prisma.sql`"userId" = ${userId}`];

  if (filters.group) {
    // Escaped underscore so the group prefix is matched literally, then any suffix.
    conditions.push(Prisma.sql`"type" LIKE ${`${filters.group}\\_%`}`);
  }
  if (filters.action) {
    // Match any prefix, then the escaped `_ACTION` suffix at the end of the type.
    conditions.push(Prisma.sql`"type" LIKE ${`%\\_${filters.action}`}`);
  }
  const search = filters.search?.trim().toLowerCase();
  if (search) {
    conditions.push(Prisma.sql`LOWER("description") LIKE ${`%${search}%`}`);
  }
  if (filters.start && filters.end) {
    conditions.push(Prisma.sql`"createdAt" >= ${filters.start}`);
    conditions.push(Prisma.sql`"createdAt" < ${filters.end}`);
  }

  const where = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<ActivityLogEntry[]>(Prisma.sql`
      SELECT "id", "type", "description", "metadata", "createdAt"
      FROM "ActivityLog"
      ${where}
      ORDER BY ${ORDER_BY_BY_SORT[sort]}
      LIMIT ${limit} OFFSET ${offset}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS count FROM "ActivityLog" ${where}
    `),
  ]);
  return { logs: rows, total: Number(countRows[0]?.count ?? 0) };
}
