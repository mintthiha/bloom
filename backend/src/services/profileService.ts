import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

const prisma = new PrismaClient();

type ProfileInput = {
  fullName?: string;
  username?: string;
  email?: string;
};

type ProfileRecord = {
  userId: string;
  fullName: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Retrieves the profile row for a user id.
 * Returns `null` when the user has not created a profile yet.
 */
export async function getProfile(userId: string) {
  const rows = await prisma.$queryRaw<ProfileRecord[]>`
    SELECT "userId", "fullName", "username", "email", "createdAt", "updatedAt"
    FROM "Profile"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Creates a new profile when the user has no existing row, or updates the
 * existing row when one already exists.
 * Validates required fields, normalizes username/email casing, and rejects
 * usernames already used by another user.
 */
export async function upsertProfile(userId: string, input: ProfileInput) {
  const fullName = input.fullName?.trim();
  const username = input.username?.trim().toLowerCase();
  const email = input.email?.trim().toLowerCase();

  if (!fullName) {
    throw new AppError(400, "Full name is required");
  }
  if (!username) {
    throw new AppError(400, "Username is required");
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    throw new AppError(400, "Username must contain only lowercase letters, numbers, or underscores");
  }
  if (username.length < 3 || username.length > 20) {
    throw new AppError(400, "Username must be between 3 and 20 characters");
  }
  if (!email) {
    throw new AppError(400, "Email is required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "Email is invalid");
  }

  const existingUsername = await prisma.$queryRaw<Pick<ProfileRecord, "userId">[]>`
    SELECT "userId"
    FROM "Profile"
    WHERE "username" = ${username}
    LIMIT 1
  `;
  if (existingUsername[0] && existingUsername[0].userId !== userId) {
    throw new AppError(409, "Username is already taken");
  }

  const rows = await prisma.$queryRaw<ProfileRecord[]>`
    INSERT INTO "Profile" ("userId", "fullName", "username", "email", "createdAt", "updatedAt")
    VALUES (${userId}, ${fullName}, ${username}, ${email}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId")
    DO UPDATE SET
      "fullName" = EXCLUDED."fullName",
      "username" = EXCLUDED."username",
      "email" = EXCLUDED."email",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "userId", "fullName", "username", "email", "createdAt", "updatedAt"
  `;

  return rows[0];
}
