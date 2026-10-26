/**
 * The saved sign-in token lives in an httpOnly cookie, so page scripts — including any injected by
 * an XSS bug — can never read it. Only the email shown on "Continue as…" is kept in localStorage.
 */
export const REMEMBER_COOKIE_NAME = "bloom_remember";

// Covers every route that reads the token (NextAuth's /api/auth callback and /api/remember-*)
// without sending it along with page and asset requests.
export const REMEMBER_COOKIE_PATH = "/api";

export type IssuedRememberToken = { email: string; token: string; expiresAt: Date };

/** Cookie attributes for the saved sign-in token, expiring when the token itself does. */
export function buildRememberCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    // Lax still sends it on Bloom's own sign-in POST but not on cross-site requests.
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: REMEMBER_COOKIE_PATH,
    expires: expiresAt,
  };
}

/** Reads one cookie from a raw `Cookie` request header, or null when it isn't there. */
export function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string
): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;
    if (pair.slice(0, separatorIndex).trim() !== name) continue;
    const value = pair.slice(separatorIndex + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

/** Validates the backend's reply to issuing a token, or returns null when it is malformed. */
export function readIssuedRememberToken(body: unknown): IssuedRememberToken | null {
  if (typeof body !== "object" || body === null) return null;
  const { email, token, expiresAt } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof token !== "string" || !token) return null;
  if (typeof expiresAt !== "string") return null;
  const expiryDate = new Date(expiresAt);
  if (Number.isNaN(expiryDate.getTime())) return null;
  return { email, token, expiresAt: expiryDate };
}
