-- Records the spending lookup a Bloom AI reply answered from, so the conversation can be replayed
-- to the model as that lookup call rather than as plain text the model would imitate. NULL on
-- every other reply. Additive only.

ALTER TABLE "ChatMessage"
  ADD COLUMN "spendingLookup" JSONB;
