-- Migrate all monetary columns from double precision (Float) to DECIMAL(19,4).
-- PostgreSQL can implicitly cast double precision → numeric, so no USING clause is needed.
-- Existing float values are preserved exactly to their stored binary representation.

ALTER TABLE "Account"              ALTER COLUMN "balance"               TYPE DECIMAL(19,4);
ALTER TABLE "Profile"              ALTER COLUMN "tfsaRoomUsedElsewhere" TYPE DECIMAL(19,4);
ALTER TABLE "Profile"              ALTER COLUMN "rrspContributionRoom"   TYPE DECIMAL(19,4);
ALTER TABLE "CategoryBudget"       ALTER COLUMN "monthlyLimit"          TYPE DECIMAL(19,4);
ALTER TABLE "Transaction"          ALTER COLUMN "amount"                TYPE DECIMAL(19,4);
ALTER TABLE "Transaction"          ALTER COLUMN "balanceAfter"          TYPE DECIMAL(19,4);
ALTER TABLE "NetWorthSnapshot"     ALTER COLUMN "netWorth"              TYPE DECIMAL(19,4);
ALTER TABLE "NetWorthSnapshot"     ALTER COLUMN "totalAssets"           TYPE DECIMAL(19,4);
ALTER TABLE "NetWorthSnapshot"     ALTER COLUMN "totalDebt"             TYPE DECIMAL(19,4);
ALTER TABLE "SavingsGoal"          ALTER COLUMN "targetAmount"          TYPE DECIMAL(19,4);
ALTER TABLE "RecurringTransaction" ALTER COLUMN "amount"                TYPE DECIMAL(19,4);
