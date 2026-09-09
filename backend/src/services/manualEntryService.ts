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
  date: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Converts a raw DB row to a clean API response object with amount as a number and date as YYYY-MM-DD. */
function normalizeRow(row: ManualEntryRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type,
    amount: Number(row.amount),
    date: row.date ? row.date.toISOString().split("T")[0] : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Returns all live (non-soft-deleted) manual entries for the user, ordered by date then creation date. */
export async function listManualEntries(userId: string) {
  const rows = await prisma.$queryRaw<ManualEntryRow[]>`
    SELECT "id", "userId", "name", "type", "amount", "date", "createdAt", "updatedAt"
    FROM "ManualEntry"
    WHERE "userId" = ${userId} AND "deletedAt" IS NULL
    ORDER BY "date" DESC NULLS LAST, "createdAt" ASC
  `;
  return rows.map(normalizeRow);
}

/** Creates a new manual asset or liability for the user. */
export async function createManualEntry(
  userId: string,
  input: { name: string; type: ManualEntryType; amount: number; date: string | null }
) {
  const id = randomUUID();
  const rows = await prisma.$queryRaw<ManualEntryRow[]>`
    INSERT INTO "ManualEntry" ("id", "userId", "name", "type", "amount", "date", "createdAt", "updatedAt")
    VALUES (
      ${id}, ${userId}, ${input.name}, ${input.type}::"ManualEntryType", ${input.amount},
      ${input.date ? new Date(input.date) : null}::date,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id", "userId", "name", "type", "amount", "date", "createdAt", "updatedAt"
  `;
  if (!rows[0]) throw new AppError(500, "Failed to create manual entry");
  return normalizeRow(rows[0]);
}

/** Updates the name, amount, and date of an existing manual entry. Throws 404 if not found. */
export async function updateManualEntry(
  userId: string,
  entryId: string,
  input: { name: string; amount: number; date: string | null }
) {
  const rows = await prisma.$queryRaw<ManualEntryRow[]>`
    UPDATE "ManualEntry"
    SET
      "name" = ${input.name},
      "amount" = ${input.amount},
      "date" = ${input.date ? new Date(input.date) : null}::date,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${entryId} AND "userId" = ${userId} AND "deletedAt" IS NULL
    RETURNING "id", "userId", "name", "type", "amount", "date", "createdAt", "updatedAt"
  `;
  if (!rows[0]) throw new AppError(404, `Manual entry ${entryId} not found`);
  return normalizeRow(rows[0]);
}

/** Soft-deletes a manual entry (recoverable via restoreManualEntry). Throws 404 if not found or already deleted. */
export async function deleteManualEntry(
  userId: string,
  entryId: string
): Promise<{ name: string; type: ManualEntryType }> {
  const rows = await prisma.$queryRaw<{ id: string; name: string; type: ManualEntryType }[]>`
    UPDATE "ManualEntry"
    SET "deletedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${entryId} AND "userId" = ${userId} AND "deletedAt" IS NULL
    RETURNING "id", "name", "type"
  `;
  if (!rows[0]) throw new AppError(404, `Manual entry ${entryId} not found`);
  return { name: rows[0].name, type: rows[0].type };
}

/** Restores a soft-deleted manual entry. Throws 404 if not found or not currently deleted. */
export async function restoreManualEntry(
  userId: string,
  entryId: string
): Promise<{ name: string; type: ManualEntryType }> {
  const rows = await prisma.$queryRaw<{ id: string; name: string; type: ManualEntryType }[]>`
    UPDATE "ManualEntry"
    SET "deletedAt" = NULL
    WHERE "id" = ${entryId} AND "userId" = ${userId} AND "deletedAt" IS NOT NULL
    RETURNING "id", "name", "type"
  `;
  if (!rows[0]) throw new AppError(404, `Manual entry ${entryId} not found`);
  return { name: rows[0].name, type: rows[0].type };
}

/** Returns the total manual assets and liabilities for a user (used by net worth snapshot). */
export async function getManualEntryTotals(
  userId: string
): Promise<{ manualAssets: number; manualLiabilities: number }> {
  const rows = await prisma.$queryRaw<{ type: ManualEntryType; total: string }[]>`
    SELECT "type", SUM("amount") AS "total"
    FROM "ManualEntry"
    WHERE "userId" = ${userId} AND "deletedAt" IS NULL
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
