-- Bloom AI conversation history, moved out of the browser's localStorage so it
-- follows the user across devices and other AI features can reference it. One row
-- per turn; additive only — nothing existing changes shape.

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage" ("userId", "createdAt");
