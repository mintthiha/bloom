import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";

export type NotificationKind = "BILL_REMINDER";
export type NotificationStatus = "UNREAD" | "READ" | "DISMISSED";

const BILL_REMINDER: NotificationKind = "BILL_REMINDER";

type NotificationRecord = {
  id: string;
  userId: string;
  kind: string;
  recurringTransactionId: string | null;
  title: string;
  body: string;
  dueDate: Date | null;
  status: string;
  createdAt: Date;
  readAt: Date | null;
};

type ReminderPreferenceRecord = {
  billRemindersEnabled: boolean;
  billReminderLeadDays: number;
};

type DueRuleRecord = {
  id: string;
  name: string;
  merchant: string | null;
  amount: string;
  nextRunAt: Date;
};

/** Serializes a DATE column to a YYYY-MM-DD string (drops the time component). */
function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Converts a raw notification row to an API-safe shape with string dates. */
function normalizeNotification(row: NotificationRecord) {
  return {
    id: row.id,
    kind: row.kind,
    recurringTransactionId: row.recurringTransactionId,
    title: row.title,
    body: row.body,
    dueDate: row.dueDate ? formatDateOnly(row.dueDate) : null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  };
}

/** Reads the user's reminder preferences, or null when no profile exists yet. */
async function getReminderPreferences(userId: string): Promise<ReminderPreferenceRecord | null> {
  const rows = await prisma.$queryRaw<ReminderPreferenceRecord[]>`
    SELECT "billRemindersEnabled", "billReminderLeadDays"
    FROM "Profile"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Generates bill-reminder notifications for the user's active withdrawal rules
 * whose next occurrence falls within the lead window (or is already overdue).
 * Deduped per rule occurrence date, so repeated calls are idempotent.
 * No-ops when the user has disabled reminders or has no profile yet.
 */
export async function generateBillReminders(userId: string, now = new Date()) {
  const preferences = await getReminderPreferences(userId);
  if (!preferences || !preferences.billRemindersEnabled) {
    return { createdCount: 0 };
  }

  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() + preferences.billReminderLeadDays);

  const rules = await prisma.$queryRaw<DueRuleRecord[]>`
    SELECT r."id", r."name", r."merchant", r."amount", r."nextRunAt"
    FROM "RecurringTransaction" r
    WHERE r."userId" = ${userId}
      AND r."active" = true
      AND r."type" = 'WITHDRAWAL'::"RecurringTransactionType"
      AND r."nextRunAt" <= ${cutoff}
      AND (r."endDate" IS NULL OR r."nextRunAt" <= r."endDate")
    ORDER BY r."nextRunAt" ASC
  `;

  let createdCount = 0;
  for (const rule of rules) {
    const dueDate = formatDateOnly(new Date(rule.nextRunAt));
    const title = rule.merchant ?? rule.name;
    const body = `Payment of $${Number(rule.amount).toFixed(2)} is due`;
    const inserted = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "Notification" (
        "id", "userId", "kind", "recurringTransactionId",
        "title", "body", "dueDate", "status", "createdAt"
      )
      VALUES (
        ${randomUUID()}, ${userId}, ${BILL_REMINDER}, ${rule.id},
        ${title}, ${body}, ${dueDate}::date, 'UNREAD', CURRENT_TIMESTAMP
      )
      ON CONFLICT ("userId", "kind", "recurringTransactionId", "dueDate") DO NOTHING
      RETURNING "id"
    `;
    if (inserted.length > 0) {
      createdCount += 1;
    }
  }

  return { createdCount };
}

/**
 * Lists a user's non-dismissed notifications (soonest due first) alongside the
 * unread count for the badge.
 */
export async function listNotifications(userId: string) {
  const rows = await prisma.$queryRaw<NotificationRecord[]>`
    SELECT "id", "userId", "kind", "recurringTransactionId",
           "title", "body", "dueDate", "status", "createdAt", "readAt"
    FROM "Notification"
    WHERE "userId" = ${userId} AND "status" <> 'DISMISSED'
    ORDER BY ("dueDate" IS NULL), "dueDate" ASC, "createdAt" DESC
  `;
  const notifications = rows.map(normalizeNotification);
  const unreadCount = notifications.filter(
    (notification) => notification.status === "UNREAD"
  ).length;
  return { notifications, unreadCount };
}

/** Marks a single notification read. Idempotent; throws 404 when it does not exist. */
export async function markNotificationRead(userId: string, id: string) {
  const rows = await prisma.$queryRaw<NotificationRecord[]>`
    UPDATE "Notification"
    SET "status" = 'READ', "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP)
    WHERE "id" = ${id} AND "userId" = ${userId} AND "status" <> 'DISMISSED'
    RETURNING "id", "userId", "kind", "recurringTransactionId",
              "title", "body", "dueDate", "status", "createdAt", "readAt"
  `;
  if (!rows[0]) {
    throw new AppError(404, `Notification ${id} not found`);
  }
  return normalizeNotification(rows[0]);
}

/** Marks every unread notification for the user read. Returns how many changed. */
export async function markAllNotificationsRead(userId: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Notification"
    SET "status" = 'READ', "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP)
    WHERE "userId" = ${userId} AND "status" = 'UNREAD'
    RETURNING "id"
  `;
  return { updated: rows.length };
}

/** Dismisses a notification so it no longer appears and is not regenerated. */
export async function dismissNotification(userId: string, id: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Notification"
    SET "status" = 'DISMISSED'
    WHERE "id" = ${id} AND "userId" = ${userId}
    RETURNING "id"
  `;
  if (!rows[0]) {
    throw new AppError(404, `Notification ${id} not found`);
  }
}
