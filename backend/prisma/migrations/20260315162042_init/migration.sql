-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHEQUING', 'SAVINGS');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'CHEQUING';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "description" TEXT;
