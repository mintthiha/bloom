-- Adds demo-account tracking to CredentialUser so seeded "Try Bloom" accounts
-- can be identified and swept up by the cleanup script once they expire.
ALTER TABLE "CredentialUser" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CredentialUser" ADD COLUMN "demoExpiresAt" TIMESTAMPTZ(3);

CREATE INDEX "CredentialUser_isDemo_demoExpiresAt_idx" ON "CredentialUser"("isDemo", "demoExpiresAt");
