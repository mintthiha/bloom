-- Tags every transaction written by a CSV import with the import it came from, so a whole import
-- can be listed and undone together. NULL for transactions created any other way (including
-- imports made before this migration). Additive only.

ALTER TABLE "Transaction"
  ADD COLUMN "importBatchId" TEXT;

CREATE INDEX "Transaction_importBatchId_idx" ON "Transaction"("importBatchId");
