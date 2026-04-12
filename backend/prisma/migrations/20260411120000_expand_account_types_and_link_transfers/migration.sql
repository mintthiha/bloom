ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'TFSA';
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'RRSP';
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'FHSA';
ALTER TYPE "AccountType" ADD VALUE IF NOT EXISTS 'CREDIT';

ALTER TABLE "Transaction"
ADD COLUMN "transferGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "Transaction_transferGroupId_idx"
ON "Transaction" ("transferGroupId");
