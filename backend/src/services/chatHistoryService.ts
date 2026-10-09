import { randomUUID } from "crypto";
import prisma from "../lib/prisma";

export type ChatMessageRole = "user" | "assistant";

export type StoredChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: Date;
};

/** A finished question-and-reply pair, ready to be written to the conversation. */
export type ChatExchange = {
  question: string;
  /** When the question arrived, so it sorts ahead of a reply that finished later. */
  askedAt: Date;
  reply: string;
};

/**
 * Returns the user's most recent messages, oldest first — the newest `limit` of them, so a long
 * conversation stays bounded for both the chat window and the model's context.
 */
export async function listRecentChatMessages(
  userId: string,
  limit: number
): Promise<StoredChatMessage[]> {
  return prisma.$queryRaw<StoredChatMessage[]>`
    SELECT "id", "role", "content", "createdAt"
    FROM (
      SELECT "id", "role", "content", "createdAt"
      FROM "ChatMessage"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    ) AS "recentMessages"
    ORDER BY "createdAt" ASC
  `;
}

/**
 * Writes a question and its reply as one statement, so the conversation never holds a question
 * without its answer. The reply is stamped strictly after the question to keep their order stable.
 */
export async function saveChatExchange(userId: string, exchange: ChatExchange): Promise<void> {
  const repliedAt = new Date(Math.max(Date.now(), exchange.askedAt.getTime() + 1));
  await prisma.$executeRaw`
    INSERT INTO "ChatMessage" ("id", "userId", "role", "content", "createdAt")
    VALUES
      (${randomUUID()}, ${userId}, 'user', ${exchange.question}, ${exchange.askedAt}::timestamptz),
      (${randomUUID()}, ${userId}, 'assistant', ${exchange.reply}, ${repliedAt}::timestamptz)
  `;
}

/** Permanently deletes the user's whole conversation and returns how many messages were removed. */
export async function clearChatMessages(userId: string): Promise<number> {
  return prisma.$executeRaw`DELETE FROM "ChatMessage" WHERE "userId" = ${userId}`;
}
