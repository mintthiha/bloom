-- Per-user notification preferences beyond bill reminders.
--
-- Every column defaults to today's hard-coded behaviour (all alert kinds on,
-- low balance at $100, milestones at 50/75/100%) so existing profiles keep
-- receiving exactly the notifications they received before this migration.
ALTER TABLE "Profile"
  ADD COLUMN "budgetOverspendAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lowBalanceAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lowBalanceThreshold" DECIMAL(19, 4) NOT NULL DEFAULT 100,
  ADD COLUMN "goalMilestoneAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "goalMilestonePercentages" INTEGER[] NOT NULL DEFAULT ARRAY[50, 75, 100],
  ADD COLUMN "subscriptionPriceAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;
