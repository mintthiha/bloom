-- Lets a Bloom AI reply carry a drafted write action (a budget, a savings goal, or a
-- categorization rule) that the user confirms or dismisses from a card in the chat.
-- "proposedAction" holds the validated draft and "proposedActionStatus" is PENDING,
-- CONFIRMED, or DISMISSED; both stay NULL on ordinary replies. Additive only.

ALTER TABLE "ChatMessage"
  ADD COLUMN "proposedAction" JSONB,
  ADD COLUMN "proposedActionStatus" TEXT;
