ALTER TABLE "Transaction"
ADD COLUMN "merchant" TEXT;

ALTER TABLE "RecurringTransaction"
ADD COLUMN "merchant" TEXT;
