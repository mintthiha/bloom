// Account lifecycle: list, create, read, rename, appearance, freeze/unfreeze, delete/restore.
// Split out of accountService.ts, which re-exports its public API.
import { AccountType } from "@prisma/client";
import { randomUUID } from "crypto";
import { AppError } from "../../middleware/errorHandler";
import prisma from "../../lib/prisma";
import { logActivity } from "../activityService";
import { accountLabel, normalizeAccount, selectAccountByUserId } from "./accountRecords";
import type { AccountRecord } from "./accountRecords";

/**
 * Retrieves all accounts for a given user, ordered by most recently created first.
 */
export async function listAccounts(userId: string) {
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    SELECT "id", "userId", "ownerName", "nickname", "color", "icon", "accountType", "balance", "frozen", "isLinked", "plaidAccountId", "plaidItemId", "institutionName", "createdAt", "updatedAt"
    FROM "Account"
    WHERE "userId" = ${userId} AND "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
  `;
  return rows.map(normalizeAccount);
}

/**
 * Creates a new bank account with a zero balance for the given user.
 * Throws 400 if the owner name is empty or missing.
 * Accepts an optional account nickname for friendlier account labels.
 * Throws 400 if the account type is not a valid AccountType enum value.
 */
export async function createAccount(
  userId: string,
  ownerName: string,
  accountType: AccountType = AccountType.CHEQUING,
  nickname?: string
) {
  if (!ownerName || ownerName.trim() === "") {
    throw new AppError(400, "ownerName is required");
  }
  if (!Object.values(AccountType).includes(accountType)) {
    throw new AppError(400, "accountType must be CHEQUING, SAVINGS, TFSA, RRSP, FHSA, or CREDIT");
  }
  const id = randomUUID();
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    INSERT INTO "Account" ("id", "userId", "ownerName", "nickname", "accountType", "balance", "frozen", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${ownerName.trim()}, ${nickname?.trim() ? nickname.trim() : null}, ${accountType}::"AccountType", 0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING "id", "userId", "ownerName", "nickname", "color", "icon", "accountType", "balance", "frozen", "createdAt", "updatedAt"
  `;
  const account = normalizeAccount(rows[0]);
  logActivity(
    userId,
    "ACCOUNT_CREATED",
    `Created a ${account.accountType} account "${accountLabel(account.ownerName, account.nickname)}"`,
    { accountId: account.id, accountType: account.accountType }
  );
  return account;
}

/**
 * Retrieves a single account by its ID.
 * Throws 404 if no account is found with the given ID.
 */
export async function getAccount(userId: string, id: string) {
  const account = await selectAccountByUserId(userId, id);
  if (!account) throw new AppError(404, `Account ${id} not found`);
  return normalizeAccount(account);
}

/**
 * Updates an account nickname.
 * Passing an empty nickname clears the custom label.
 * Throws 404 if the account does not exist.
 */
export async function updateNickname(userId: string, id: string, nickname?: string) {
  await getAccount(userId, id);
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    UPDATE "Account"
    SET "nickname" = ${nickname?.trim() ? nickname.trim() : null},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "userId" = ${userId}
    RETURNING "id", "userId", "ownerName", "nickname", "color", "icon", "accountType", "balance", "frozen", "createdAt", "updatedAt"
  `;
  const account = normalizeAccount(rows[0]);
  const description = account.nickname
    ? `Renamed account to "${account.nickname}"`
    : `Cleared nickname on account "${account.ownerName}"`;
  logActivity(userId, "ACCOUNT_RENAMED", description, { accountId: account.id });
  return account;
}

/**
 * Updates an account's custom colour and/or icon, used to tell visually similar accounts
 * (e.g. several chequing accounts) apart at a glance. Passing null for either field clears
 * it back to the account type's default appearance.
 * Throws 404 if the account does not exist.
 */
export async function updateAccountAppearance(
  userId: string,
  id: string,
  { color, icon }: { color: string | null; icon: string | null }
) {
  await getAccount(userId, id);
  const rows = await prisma.$queryRaw<AccountRecord[]>`
    UPDATE "Account"
    SET "color" = ${color},
        "icon" = ${icon},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id} AND "userId" = ${userId}
    RETURNING "id", "userId", "ownerName", "nickname", "color", "icon", "accountType", "balance", "frozen", "createdAt", "updatedAt"
  `;
  const account = normalizeAccount(rows[0]);
  logActivity(
    userId,
    "ACCOUNT_APPEARANCE_UPDATED",
    `Updated appearance for account "${accountLabel(account.ownerName, account.nickname)}"`,
    { accountId: account.id }
  );
  return account;
}

/**
 * Freezes an account, preventing all future transactions.
 * Throws 404 if the account does not exist.
 */
export async function freezeAccount(userId: string, id: string) {
  await getAccount(userId, id);
  await prisma.account.update({
    where: { id },
    data: { frozen: true },
  });
  const frozenAccount = await getAccount(userId, id);
  logActivity(
    userId,
    "ACCOUNT_FROZEN",
    `Froze account "${accountLabel(frozenAccount.ownerName, frozenAccount.nickname)}"`,
    { accountId: id }
  );
  return frozenAccount;
}

/**
 * Unfreezes an account, restoring the ability to transact.
 * Throws 404 if the account does not exist.
 */
export async function unfreezeAccount(userId: string, id: string) {
  await getAccount(userId, id);
  await prisma.account.update({
    where: { id },
    data: { frozen: false },
  });
  const unfrozenAccount = await getAccount(userId, id);
  logActivity(
    userId,
    "ACCOUNT_UNFROZEN",
    `Unfroze account "${accountLabel(unfrozenAccount.ownerName, unfrozenAccount.nickname)}"`,
    { accountId: id }
  );
  return unfrozenAccount;
}

/**
 * Soft-deletes an account and, with the same timestamp, every one of its
 * still-live transactions (recoverable via restoreAccount). The shared timestamp
 * lets the restore re-attach exactly the transactions this call removed, leaving
 * any the user had already deleted individually untouched.
 * Throws 404 if the account does not exist or is already deleted.
 */
export async function deleteAccount(userId: string, id: string) {
  const accountToDelete = await getAccount(userId, id);
  const deletedAt = new Date();
  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: {
        deletedAt: null,
        OR: [{ fromAccountId: id }, { toAccountId: id }],
      },
      data: { deletedAt },
    }),
    prisma.account.update({ where: { id }, data: { deletedAt } }),
  ]);
  logActivity(
    userId,
    "ACCOUNT_DELETED",
    `Deleted account "${accountLabel(accountToDelete.ownerName, accountToDelete.nickname)}"`,
    { accountId: id, accountType: accountToDelete.accountType }
  );
}

/**
 * Restores a soft-deleted account (the "Undo" action after a delete) along with
 * the transactions removed by the same delete (matched on the shared timestamp).
 * Throws 404 if the account does not exist or is not currently deleted.
 */
export async function restoreAccount(userId: string, id: string) {
  const rows = await prisma.$queryRaw<
    { deletedAt: Date; ownerName: string; nickname: string | null }[]
  >`
    SELECT "deletedAt", "ownerName", "nickname"
    FROM "Account"
    WHERE "id" = ${id} AND "userId" = ${userId} AND "deletedAt" IS NOT NULL
    LIMIT 1
  `;
  const deletedAccount = rows[0];
  if (!deletedAccount) throw new AppError(404, `Account ${id} not found`);

  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: {
        deletedAt: deletedAccount.deletedAt,
        OR: [{ fromAccountId: id }, { toAccountId: id }],
      },
      data: { deletedAt: null },
    }),
    prisma.account.update({ where: { id }, data: { deletedAt: null } }),
  ]);
  logActivity(
    userId,
    "ACCOUNT_RESTORED",
    `Restored account "${accountLabel(deletedAccount.ownerName, deletedAccount.nickname)}"`,
    { accountId: id }
  );
  return getAccount(userId, id);
}
