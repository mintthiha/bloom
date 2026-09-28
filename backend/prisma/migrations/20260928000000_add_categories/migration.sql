-- Custom categories: a per-user reference list of names, colors, and icons that
-- back every category picker (transactions, budgets, recurring rules, auto-
-- categorize). Category names on those other tables stay plain strings, so this
-- table is additive only — nothing existing changes shape.

CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "CategoryType" NOT NULL,
  "color" TEXT NOT NULL,
  "icon" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category" ("userId", "name");
CREATE INDEX "Category_userId_type_idx" ON "Category" ("userId", "type");
