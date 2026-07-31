-- Generalize notifications beyond bill reminders.
-- A generic per-user dedupe key replaces the bill-specific composite index, and
-- an optional linkHref lets a notification deep-link to the relevant page.

ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "Notification" ADD COLUMN "linkHref" TEXT;

-- Backfill existing rows with a key equivalent to the old (kind, rule, dueDate) uniqueness.
UPDATE "Notification"
SET "dedupeKey" = "kind"
  || ':' || COALESCE("recurringTransactionId", '')
  || ':' || COALESCE("dueDate"::text, '')
WHERE "dedupeKey" IS NULL;

ALTER TABLE "Notification" ALTER COLUMN "dedupeKey" SET NOT NULL;

-- Swap the bill-specific unique index for the generic one.
DROP INDEX "Notification_dedupe_key";
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key"
  ON "Notification" ("userId", "dedupeKey");
