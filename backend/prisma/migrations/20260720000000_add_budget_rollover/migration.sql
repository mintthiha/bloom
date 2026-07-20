-- Opt-in rollover flag for existing/new budgets (defaults off, preserving cap behavior)
ALTER TABLE "CategoryBudget" ADD COLUMN "rolloverEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Per-month envelope state: optional limit override + manual adjustment (move money)
CREATE TABLE "BudgetPeriod" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "limitOverride" DECIMAL(19,4),
    "adjustment" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BudgetPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BudgetPeriod_budgetId_month_key" ON "BudgetPeriod"("budgetId", "month");

CREATE INDEX "BudgetPeriod_userId_idx" ON "BudgetPeriod"("userId");

ALTER TABLE "BudgetPeriod" ADD CONSTRAINT "BudgetPeriod_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "CategoryBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
