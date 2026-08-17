import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const REMEMBER_TOKEN_BYTES = 32;
const REMEMBER_TOKEN_TTL_DAYS = 30;

/** Hashes a remember-me token with SHA-256 for storage; the raw token itself is never persisted. */
function hashRememberToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a new credential user with a bcrypt-hashed password.
 * Throws 409 when the email is already registered.
 */
export async function registerUser(
  email: string,
  password: string
): Promise<{ id: string; email: string }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const existing = await prisma.credentialUser.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.credentialUser.create({ data: { email, passwordHash } });
  return { id: user.id, email: user.email };
}

/**
 * Verifies an email and password against the stored hash.
 * Returns the user id and email on success, or null when credentials are invalid.
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string } | null> {
  const user = await prisma.credentialUser.findUnique({ where: { email } });
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;

  return { id: user.id, email: user.email };
}

/**
 * Verifies email and password, then issues a "remember me" token for that user.
 * Returns null when the credentials are invalid; throws only on unexpected errors.
 */
export async function issueRememberToken(
  email: string,
  password: string
): Promise<{ id: string; email: string; token: string; expiresAt: Date } | null> {
  const user = await verifyCredentials(email, password);
  if (!user) return null;

  const token = crypto.randomBytes(REMEMBER_TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + REMEMBER_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.rememberToken.create({
    data: { userId: user.id, tokenHash: hashRememberToken(token), expiresAt },
  });

  return { ...user, token, expiresAt };
}

/**
 * Exchanges a "remember me" token for the user it was issued to.
 * Returns null when the token is unknown or has expired, deleting expired rows as it finds them.
 */
export async function verifyRememberToken(
  token: string
): Promise<{ id: string; email: string } | null> {
  const record = await prisma.rememberToken.findUnique({
    where: { tokenHash: hashRememberToken(token) },
    include: { user: true },
  });
  if (!record) return null;

  if (record.expiresAt < new Date()) {
    await prisma.rememberToken.delete({ where: { id: record.id } });
    return null;
  }

  return { id: record.user.id, email: record.user.email };
}

/**
 * Revokes a "remember me" token, e.g. when the user removes a saved account from the login screen.
 * A no-op when the token is already gone.
 */
export async function revokeRememberToken(token: string): Promise<void> {
  await prisma.rememberToken.deleteMany({ where: { tokenHash: hashRememberToken(token) } });
}
