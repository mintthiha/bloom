-- Bill reminders / in-app notification center

-- Per-user reminder preferences (opt-out + how many days ahead to warn).
ALTER TABLE "Profile"
  ADD COLUMN "billRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "billReminderLeadDays" INTEGER NOT NULL DEFAULT 3;

-- Notification records. `kind` keeps the table open to future notification
-- types beyond bill reminders. `status` moves UNREAD -> READ -> DISMISSED.
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "recurringTransactionId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "dueDate" DATE,
  "status" TEXT NOT NULL DEFAULT 'UNREAD',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMPTZ(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Dedupe key: one reminder per rule occurrence date. For BILL_REMINDER both
-- recurringTransactionId and dueDate are always set, so ON CONFLICT applies.
CREATE UNIQUE INDEX "Notification_dedupe_key"
  ON "Notification" ("userId", "kind", "recurringTransactionId", "dueDate");

CREATE INDEX "Notification_userId_status_idx"
  ON "Notification" ("userId", "status");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_recurringTransactionId_fkey"
  FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
