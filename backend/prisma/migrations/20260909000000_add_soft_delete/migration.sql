-- Soft-delete support: a nullable "deletedAt" marks a row as removed while keeping
-- it recoverable. All application reads filter `WHERE "deletedAt" IS NULL`.

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "Transaction" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "ManualEntry" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "CategoryBudget" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "SavingsGoal" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "RecurringTransaction" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "AutoCategorizationRule" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

-- Replace the full unique indexes with PARTIAL ones so a soft-deleted row no
-- longer occupies its (userId, category) / (userId, merchant) slot.
DROP INDEX "CategoryBudget_userId_category_key";
CREATE UNIQUE INDEX "CategoryBudget_userId_category_key" ON "CategoryBudget"("userId", "category") WHERE "deletedAt" IS NULL;

DROP INDEX "AutoCategorizationRule_userId_merchant_key";
CREATE UNIQUE INDEX "AutoCategorizationRule_userId_merchant_key" ON "AutoCategorizationRule"("userId", "merchant") WHERE "deletedAt" IS NULL;

-- Partial indexes to keep the common "live rows only" list reads fast.
CREATE INDEX "Transaction_fromAccountId_live_idx" ON "Transaction"("fromAccountId") WHERE "deletedAt" IS NULL;
CREATE INDEX "Transaction_toAccountId_live_idx" ON "Transaction"("toAccountId") WHERE "deletedAt" IS NULL;
CREATE INDEX "ManualEntry_userId_live_idx" ON "ManualEntry"("userId") WHERE "deletedAt" IS NULL;
CREATE INDEX "SavingsGoal_userId_live_idx" ON "SavingsGoal"("userId") WHERE "deletedAt" IS NULL;
CREATE INDEX "RecurringTransaction_userId_live_idx" ON "RecurringTransaction"("userId") WHERE "deletedAt" IS NULL;
CREATE INDEX "CategoryBudget_userId_live_idx" ON "CategoryBudget"("userId") WHERE "deletedAt" IS NULL;
