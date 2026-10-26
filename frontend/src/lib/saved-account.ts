/** localStorage key for the account shown on the login page's "Continue as…" button. */
export const SAVED_ACCOUNT_STORAGE_KEY = "bloom_saved_account";

/** What the login page keeps about a saved account: just the email to display. */
export type SavedAccount = { email: string };

/**
 * Reads the stored saved account, keeping only the email. Entries written before the token
 * moved into an httpOnly cookie also held the raw token; it is dropped here so the caller can
 * rewrite the entry without it. Returns null for a missing or malformed entry.
 */
export function parseSavedAccount(storedValue: string | null): SavedAccount | null {
  if (!storedValue) return null;
  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { email } = parsed as Record<string, unknown>;
    return typeof email === "string" && email.trim() ? { email } : null;
  } catch {
    return null;
  }
}
