-- CreateTable
CREATE TABLE "TransactionSplit" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionSplit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionSplit_transactionId_idx" ON "TransactionSplit"("transactionId");

-- AddForeignKey
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateView
-- Expands every transaction into one row per category line item: a split
-- transaction contributes one row per TransactionSplit (category/amount taken
-- from the split), while an unsplit transaction contributes its own single row
-- (category/amount taken from the Transaction itself). Category-aggregated
-- queries (50/30/20 summary, category breakdown, monthly trends, budgets) read
-- from this view instead of "Transaction" directly so a split transaction's
-- spending lands under each of its categories rather than only its original one.
CREATE VIEW "TransactionLineItem" AS
SELECT
  t."id",
  t."type",
  t."effectiveAt",
  t."createdAt",
  t."deletedAt",
  t."fromAccountId",
  t."toAccountId",
  t."description",
  COALESCE(s."category", t."category") AS "category",
  COALESCE(s."amount", t."amount") AS "amount"
FROM "Transaction" t
LEFT JOIN "TransactionSplit" s ON s."transactionId" = t."id";
