ALTER TABLE "Transaction"
ADD COLUMN "effectiveAt" TIMESTAMP(3);

UPDATE "Transaction"
SET "effectiveAt" = "createdAt"
WHERE "effectiveAt" IS NULL;

ALTER TABLE "Transaction"
ALTER COLUMN "effectiveAt" SET NOT NULL,
ALTER COLUMN "effectiveAt" SET DEFAULT CURRENT_TIMESTAMP;
