-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "province" TEXT,
ADD COLUMN     "monthlyTakeHomeIncome" DECIMAL(19,4),
ADD COLUMN     "payFrequency" TEXT,
ADD COLUMN     "nextPayday" DATE,
ADD COLUMN     "primaryFinancialGoal" TEXT;
