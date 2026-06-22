import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";

type ProfileInput = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  tfsaBirthYear?: number | null;
  tfsaRoomUsedElsewhere?: number | null;
  rrspContributionRoom?: number | null;
};

type ProfileRecord = {
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  tfsaBirthYear: number | null;
  tfsaRoomUsedElsewhere: string | null;
  rrspContributionRoom: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Retrieves the profile row for a user id.
 * Returns `null` when the user has not created a profile yet.
 */
export async function getProfile(userId: string) {
  const rows = await prisma.$queryRaw<ProfileRecord[]>`
    SELECT "userId", "firstName", "lastName", "username", "email",
           "tfsaBirthYear",
           "tfsaRoomUsedElsewhere",
           "rrspContributionRoom",
           "createdAt", "updatedAt"
    FROM "Profile"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    tfsaRoomUsedElsewhere: row.tfsaRoomUsedElsewhere != null ? Number(row.tfsaRoomUsedElsewhere) : null,
    rrspContributionRoom: row.rrspContributionRoom != null ? Number(row.rrspContributionRoom) : null,
  };
}

/**
 * Creates a new profile when the user has no existing row, or updates the
 * existing row when one already exists.
 * Validates required fields, normalizes username/email casing, and rejects
 * usernames already used by another user.
 */
export async function upsertProfile(userId: string, input: ProfileInput) {
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const username = input.username?.trim().toLowerCase();
  const email = input.email?.trim().toLowerCase();

  if (!firstName) {
    throw new AppError(400, "First name is required");
  }
  if (!lastName) {
    throw new AppError(400, "Last name is required");
  }
  if (firstName.length > 50) {
    throw new AppError(400, "First name must be at most 50 characters");
  }
  if (lastName.length > 50) {
    throw new AppError(400, "Last name must be at most 50 characters");
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
  if (email.length > 254) {
    throw new AppError(400, "Email must be at most 254 characters");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "Email is invalid");
  }

  if (input.tfsaBirthYear !== undefined && input.tfsaBirthYear !== null) {
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(input.tfsaBirthYear) || input.tfsaBirthYear < 1900 || input.tfsaBirthYear > currentYear) {
      throw new AppError(400, `tfsaBirthYear must be between 1900 and ${currentYear}`);
    }
  }
  if (input.tfsaRoomUsedElsewhere !== undefined && input.tfsaRoomUsedElsewhere !== null) {
    if (input.tfsaRoomUsedElsewhere < 0) {
      throw new AppError(400, "tfsaRoomUsedElsewhere must be at least 0");
    }
  }
  if (input.rrspContributionRoom !== undefined && input.rrspContributionRoom !== null) {
    if (input.rrspContributionRoom < 0) {
      throw new AppError(400, "rrspContributionRoom must be at least 0");
    }
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

  const tfsaBirthYear = input.tfsaBirthYear ?? null;
  const tfsaRoomUsedElsewhere = input.tfsaRoomUsedElsewhere ?? null;
  const rrspContributionRoom = input.rrspContributionRoom ?? null;

  const rows = await prisma.$queryRaw<ProfileRecord[]>`
    INSERT INTO "Profile" ("userId", "firstName", "lastName", "username", "email",
                           "tfsaBirthYear", "tfsaRoomUsedElsewhere", "rrspContributionRoom",
                           "createdAt", "updatedAt")
    VALUES (${userId}, ${firstName}, ${lastName}, ${username}, ${email},
            ${tfsaBirthYear}, ${tfsaRoomUsedElsewhere}, ${rrspContributionRoom},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId")
    DO UPDATE SET
      "firstName" = EXCLUDED."firstName",
      "lastName" = EXCLUDED."lastName",
      "username" = EXCLUDED."username",
      "email" = EXCLUDED."email",
      "tfsaBirthYear" = EXCLUDED."tfsaBirthYear",
      "tfsaRoomUsedElsewhere" = EXCLUDED."tfsaRoomUsedElsewhere",
      "rrspContributionRoom" = EXCLUDED."rrspContributionRoom",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "userId", "firstName", "lastName", "username", "email",
              "tfsaBirthYear",
              "tfsaRoomUsedElsewhere",
              "rrspContributionRoom",
              "createdAt", "updatedAt"
  `;

  const row = rows[0];
  return {
    ...row,
    tfsaRoomUsedElsewhere: row.tfsaRoomUsedElsewhere != null ? Number(row.tfsaRoomUsedElsewhere) : null,
    rrspContributionRoom: row.rrspContributionRoom != null ? Number(row.rrspContributionRoom) : null,
  };
}
