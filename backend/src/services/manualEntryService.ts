import { randomUUID } from "crypto";
import { ManualEntryType } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";

type ManualEntryRow = {
  id: string;
  userId: string;
  name: string;
  type: ManualEntryType;
  amount: string | number;
  createdAt: Date;
  updatedAt: Date;
};

/** Converts a raw DB row to a clean API response object with amount as a number. */
function normalizeRow(row: ManualEntryRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type,
    amount: Number(row.amount),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Returns all manual entries for the user, ordered by creation date. */
export async function listManualEntries(userId: string) {
  const rows = await prisma.$queryRaw<ManualEntryRow[]>`
    SELECT "id", "userId", "name", "type", "amount", "createdAt", "updatedAt"
    FROM "ManualEntry"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" ASC
  `;
  return rows.map(normalizeRow);
}

/** Creates a new manual asset or liability for the user. */
export async function createManualEntry(
  userId: string,
  input: { name: string; type: ManualEntryType; amount: number }
) {
  const id = randomUUID();
  const rows = await prisma.$queryRaw<ManualEntryRow[]>`
    INSERT INTO "ManualEntry" ("id", "userId", "name", "type", "amount", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${input.name}, ${input.type}::"ManualEntryType", ${input.amount}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING "id", "userId", "name", "type", "amount", "createdAt", "updatedAt"
  `;
  if (!rows[0]) throw new AppError(500, "Failed to create manual entry");
  return normalizeRow(rows[0]);
}

/** Updates the name and amount of an existing manual entry. Throws 404 if not found. */
export async function updateManualEntry(
  userId: string,
  entryId: string,
  input: { name: string; amount: number }
) {
  const rows = await prisma.$queryRaw<ManualEntryRow[]>`
    UPDATE "ManualEntry"
    SET "name" = ${input.name}, "amount" = ${input.amount}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${entryId} AND "userId" = ${userId}
    RETURNING "id", "userId", "name", "type", "amount", "createdAt", "updatedAt"
  `;
  if (!rows[0]) throw new AppError(404, `Manual entry ${entryId} not found`);
  return normalizeRow(rows[0]);
}

/** Deletes a manual entry. Throws 404 if the entry does not belong to the user. */
export async function deleteManualEntry(userId: string, entryId: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    DELETE FROM "ManualEntry"
    WHERE "id" = ${entryId} AND "userId" = ${userId}
    RETURNING "id"
  `;
  if (!rows[0]) throw new AppError(404, `Manual entry ${entryId} not found`);
}

/** Returns the total manual assets and liabilities for a user (used by net worth snapshot). */
export async function getManualEntryTotals(
  userId: string
): Promise<{ manualAssets: number; manualLiabilities: number }> {
  const rows = await prisma.$queryRaw<{ type: ManualEntryType; total: string }[]>`
    SELECT "type", SUM("amount") AS "total"
    FROM "ManualEntry"
    WHERE "userId" = ${userId}
    GROUP BY "type"
  `;
  let manualAssets = 0;
  let manualLiabilities = 0;
  for (const row of rows) {
    if (row.type === "ASSET") manualAssets = Number(row.total);
    else manualLiabilities = Number(row.total);
  }
  return { manualAssets, manualLiabilities };
}
