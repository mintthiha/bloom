-- AlterTable: add Plaid tracking fields to Account
ALTER TABLE "Account"
  ADD COLUMN "isLinked"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "plaidAccountId"  TEXT,
  ADD COLUMN "plaidItemId"     TEXT,
  ADD COLUMN "institutionName" TEXT;

-- CreateIndex: enforce uniqueness of Plaid account IDs
CREATE UNIQUE INDEX "Account_plaidAccountId_key" ON "Account"("plaidAccountId");

-- AlterTable: add Plaid transaction ID for idempotent syncing
ALTER TABLE "Transaction"
  ADD COLUMN "plaidTransactionId" TEXT;

-- CreateIndex: enforce uniqueness of Plaid transaction IDs
CREATE UNIQUE INDEX "Transaction_plaidTransactionId_key" ON "Transaction"("plaidTransactionId");

-- CreateTable: persists Plaid item access tokens (plain text — encrypt before production)
CREATE TABLE "PlaidItem" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "accessToken"     TEXT NOT NULL,
  "itemId"          TEXT NOT NULL,
  "institutionName" TEXT NOT NULL,
  "createdAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PlaidItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: itemId must be globally unique
CREATE UNIQUE INDEX "PlaidItem_itemId_key" ON "PlaidItem"("itemId");
