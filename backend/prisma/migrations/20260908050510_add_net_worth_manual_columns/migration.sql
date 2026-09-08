-- AlterTable
ALTER TABLE "NetWorthSnapshot" ADD COLUMN     "manualAssets" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "manualLiabilities" DECIMAL(19,4) NOT NULL DEFAULT 0;
