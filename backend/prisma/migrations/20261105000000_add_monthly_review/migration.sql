-- Records each month a user has finished their monthly review, so the review page can show
-- completion and a streak, and the reminder stops once the month is reviewed. Additive only.

CREATE TABLE "MonthlyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlyReview_userId_month_key" ON "MonthlyReview"("userId", "month");
