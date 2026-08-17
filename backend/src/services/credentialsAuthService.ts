import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

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
