ALTER TABLE "RecurringTransaction"
ADD COLUMN "name" TEXT;

UPDATE "RecurringTransaction"
SET "name" = COALESCE(NULLIF(TRIM("description"), ''), NULLIF(TRIM("category"), ''), 'Recurring transaction')
WHERE "name" IS NULL;

ALTER TABLE "RecurringTransaction"
ALTER COLUMN "name" SET NOT NULL;
