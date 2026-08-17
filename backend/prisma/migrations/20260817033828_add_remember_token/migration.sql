-- CreateTable
CREATE TABLE "RememberToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RememberToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RememberToken_tokenHash_key" ON "RememberToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RememberToken_userId_idx" ON "RememberToken"("userId");

-- AddForeignKey
ALTER TABLE "RememberToken" ADD CONSTRAINT "RememberToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "CredentialUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
