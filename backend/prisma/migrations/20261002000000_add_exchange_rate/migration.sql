-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" INTEGER NOT NULL,
    "cadToUsd" DECIMAL(12,6) NOT NULL,
    "cadToEur" DECIMAL(12,6) NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);
