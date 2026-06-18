-- CreateIndex
CREATE INDEX "Transaction_fromAccountId_effectiveAt_idx" ON "Transaction"("fromAccountId", "effectiveAt");

-- CreateIndex
CREATE INDEX "Transaction_toAccountId_effectiveAt_idx" ON "Transaction"("toAccountId", "effectiveAt");
