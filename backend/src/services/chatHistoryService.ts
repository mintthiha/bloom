import { randomUUID } from "crypto";
import prisma from "../lib/prisma";
import type { ProposedChatAction, ProposedChatActionStatus } from "./chatActionProposals";

export type ChatMessageRole = "user" | "assistant";

export type StoredChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  /** The write this reply drafted for the user to confirm, or null on an ordinary message. */
  proposedAction: ProposedChatAction | null;
  proposedActionStatus: ProposedChatActionStatus | null;
  createdAt: Date;
};

/** A finished question-and-reply pair, ready to be written to the conversation. */
export type ChatExchange = {
  question: string;
  /** When the question arrived, so it sorts ahead of a reply that finished later. */
  askedAt: Date;
  reply: string;
  /** The draft the reply carries, stored as pending until the user confirms or dismisses it. */
  proposedAction?: ProposedChatAction;
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
    SELECT "id", "role", "content", "proposedAction", "proposedActionStatus", "createdAt"
    FROM (
      SELECT "id", "role", "content", "proposedAction", "proposedActionStatus", "createdAt"
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
 * Returns the reply's id, which is what a draft carried by that reply is confirmed against.
 */
export async function saveChatExchange(userId: string, exchange: ChatExchange): Promise<string> {
  const repliedAt = new Date(Math.max(Date.now(), exchange.askedAt.getTime() + 1));
  const replyMessageId = randomUUID();
  const proposedActionJson = exchange.proposedAction
    ? JSON.stringify(exchange.proposedAction)
    : null;
  const proposedActionStatus: ProposedChatActionStatus | null = exchange.proposedAction
    ? "PENDING"
    : null;
  await prisma.$executeRaw`
    INSERT INTO "ChatMessage"
      ("id", "userId", "role", "content", "createdAt", "proposedAction", "proposedActionStatus")
    VALUES
      (${randomUUID()}, ${userId}, 'user', ${exchange.question}, ${exchange.askedAt}::timestamptz,
        NULL, NULL),
      (${replyMessageId}, ${userId}, 'assistant', ${exchange.reply}, ${repliedAt}::timestamptz,
        ${proposedActionJson}::jsonb, ${proposedActionStatus})
  `;
  return replyMessageId;
}

/**
 * Moves a message's draft from one status to another, but only while it is still in the expected
 * one — so two confirms racing each other cannot both win. Returns the draft that was moved, or
 * null when no draft of that user's was in the expected status.
 */
export async function moveProposedActionStatus(
  userId: string,
  messageId: string,
  expectedStatus: ProposedChatActionStatus,
  nextStatus: ProposedChatActionStatus
): Promise<ProposedChatAction | null> {
  const rows = await prisma.$queryRaw<{ proposedAction: ProposedChatAction }[]>`
    UPDATE "ChatMessage"
    SET "proposedActionStatus" = ${nextStatus}
    WHERE "id" = ${messageId}
      AND "userId" = ${userId}
      AND "proposedActionStatus" = ${expectedStatus}
    RETURNING "proposedAction"
  `;
  return rows[0]?.proposedAction ?? null;
}

/** Returns where a message's draft stands, or null when that user has no such message or draft. */
export async function getProposedActionStatus(
  userId: string,
  messageId: string
): Promise<ProposedChatActionStatus | null> {
  const rows = await prisma.$queryRaw<{ proposedActionStatus: ProposedChatActionStatus | null }[]>`
    SELECT "proposedActionStatus"
    FROM "ChatMessage"
    WHERE "id" = ${messageId} AND "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0]?.proposedActionStatus ?? null;
}

/** Permanently deletes the user's whole conversation and returns how many messages were removed. */
export async function clearChatMessages(userId: string): Promise<number> {
  return prisma.$executeRaw`DELETE FROM "ChatMessage" WHERE "userId" = ${userId}`;
}
