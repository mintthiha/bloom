import { randomUUID } from "crypto";
import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";
import { listAccounts } from "./accountService";
import { listBudgets } from "./budgetService";
import { listSavingsGoals } from "./savingsGoalService";
import { getSubscriptionSummary } from "./subscriptionService";

export type NotificationKind =
  | "BILL_REMINDER"
  | "LOW_BALANCE"
  | "BUDGET_OVERSPEND"
  | "GOAL_REACHED"
  | "SUBSCRIPTION_PRICE";

/** Cash accounts at or below this balance raise a low-balance alert. */
const LOW_BALANCE_THRESHOLD = 100;

type NotificationRecord = {
  id: string;
  userId: string;
  kind: string;
  recurringTransactionId: string | null;
  title: string;
  body: string;
  dueDate: Date | null;
  linkHref: string | null;
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

type CreateNotificationParams = {
  kind: NotificationKind;
  dedupeKey: string;
  title: string;
  body: string;
  dueDate?: string | null;
  linkHref?: string | null;
  recurringTransactionId?: string | null;
};

/** Serializes a DATE column to a YYYY-MM-DD string (drops the time component). */
function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Formats a numeric amount as a plain dollar string, e.g. 85.5 -> "$85.50". */
function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
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
    linkHref: row.linkHref,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  };
}

/**
 * Inserts a notification, ignoring it when one with the same (userId, dedupeKey)
 * already exists. Returns true when a new row was created.
 */
async function createNotification(
  userId: string,
  params: CreateNotificationParams
): Promise<boolean> {
  const inserted = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "Notification" (
      "id", "userId", "kind", "dedupeKey", "recurringTransactionId",
      "title", "body", "dueDate", "linkHref", "status", "createdAt"
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${params.kind}, ${params.dedupeKey},
      ${params.recurringTransactionId ?? null}, ${params.title}, ${params.body},
      ${params.dueDate ?? null}::date, ${params.linkHref ?? null}, 'UNREAD', CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "dedupeKey") DO NOTHING
    RETURNING "id"
  `;
  return inserted.length > 0;
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
    const created = await createNotification(userId, {
      kind: "BILL_REMINDER",
      dedupeKey: `BILL_REMINDER:${rule.id}:${dueDate}`,
      title: rule.merchant ?? rule.name,
      body: `Payment of ${formatMoney(Number(rule.amount))} is due`,
      dueDate,
      linkHref: "/",
      recurringTransactionId: rule.id,
    });
    if (created) createdCount += 1;
  }

  return { createdCount };
}

/** Alerts when a chequing or savings account balance falls to the low threshold. */
export async function generateLowBalanceAlerts(userId: string) {
  const accounts = await listAccounts(userId);
  let createdCount = 0;
  for (const account of accounts) {
    const isCashAccount = account.accountType === "CHEQUING" || account.accountType === "SAVINGS";
    if (!isCashAccount || account.frozen) continue;
    if (account.balance >= LOW_BALANCE_THRESHOLD) continue;

    const created = await createNotification(userId, {
      kind: "LOW_BALANCE",
      dedupeKey: `LOW_BALANCE:${account.id}`,
      title: account.nickname ?? account.ownerName,
      body: `Balance is low: ${formatMoney(account.balance)}`,
      linkHref: `/account/${account.id}`,
    });
    if (created) createdCount += 1;
  }
  return { createdCount };
}

/** Alerts when a category budget is over its limit for the current month. */
export async function generateBudgetOverspendAlerts(userId: string) {
  const budgets = await listBudgets(userId);
  let createdCount = 0;
  for (const budget of budgets) {
    if (!budget.isOverBudget) continue;

    const created = await createNotification(userId, {
      kind: "BUDGET_OVERSPEND",
      dedupeKey: `BUDGET_OVERSPEND:${budget.id}:${budget.month}`,
      title: budget.category,
      body: `Over budget by ${formatMoney(Math.abs(budget.remaining))} this month`,
      linkHref: "/budgets",
    });
    if (created) createdCount += 1;
  }
  return { createdCount };
}

/** Alerts once when a savings goal reaches (or passes) 100%. */
export async function generateGoalReachedAlerts(userId: string) {
  const goals = await listSavingsGoals(userId);
  let createdCount = 0;
  for (const goal of goals) {
    if (goal.percentageReached < 100) continue;

    const created = await createNotification(userId, {
      kind: "GOAL_REACHED",
      dedupeKey: `GOAL_REACHED:${goal.id}`,
      title: goal.name,
      body: "You reached your savings goal!",
      linkHref: "/goals",
    });
    if (created) createdCount += 1;
  }
  return { createdCount };
}

/** Alerts when a detected subscription's price has increased. */
export async function generateSubscriptionPriceAlerts(userId: string) {
  const summary = await getSubscriptionSummary(userId);
  let createdCount = 0;
  for (const subscription of summary.subscriptions) {
    const change = subscription.priceChange;
    if (!change || change.pct <= 0) continue;

    const created = await createNotification(userId, {
      kind: "SUBSCRIPTION_PRICE",
      dedupeKey: `SUBSCRIPTION_PRICE:${subscription.merchant}:${change.to}`,
      title: subscription.merchant,
      body: `Price rose to ${formatMoney(change.to)} (+${Math.round(change.pct)}%)`,
      linkHref: "/subscriptions",
    });
    if (created) createdCount += 1;
  }
  return { createdCount };
}

/**
 * Runs every notification generator for the user. Each generator is isolated so
 * one failing source (e.g. a slow subscription scan) never blocks the others.
 */
export async function generateNotifications(userId: string) {
  const generators = [
    generateBillReminders,
    generateLowBalanceAlerts,
    generateBudgetOverspendAlerts,
    generateGoalReachedAlerts,
    generateSubscriptionPriceAlerts,
  ];

  let createdCount = 0;
  for (const generate of generators) {
    try {
      const result = await generate(userId);
      createdCount += result.createdCount;
    } catch {
      // A single generator failing must not break the notifications fetch.
    }
  }
  return { createdCount };
}

/**
 * Lists a user's non-dismissed notifications (soonest due first, then newest)
 * alongside the unread count for the badge.
 */
export async function listNotifications(userId: string) {
  const rows = await prisma.$queryRaw<NotificationRecord[]>`
    SELECT "id", "userId", "kind", "recurringTransactionId",
           "title", "body", "dueDate", "linkHref", "status", "createdAt", "readAt"
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
              "title", "body", "dueDate", "linkHref", "status", "createdAt", "readAt"
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
