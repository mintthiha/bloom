-- CreateEnum
CREATE TYPE "ManualEntryType" AS ENUM ('ASSET', 'LIABILITY');

-- CreateTable
CREATE TABLE "ManualEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ManualEntryType" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ManualEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualEntry_userId_idx" ON "ManualEntry"("userId");
