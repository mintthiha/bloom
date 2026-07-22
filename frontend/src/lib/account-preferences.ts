// Per-user account display preferences, persisted in localStorage alongside the dashboard's other
// client-side preferences (card order, visibility, etc.). Pinned accounts drive the compact
// dashboard card; hidden accounts declutter the full /accounts list without affecting any totals.

const PINNED_KEY = "bloom-pinned-accounts";
const HIDDEN_KEY = "bloom-hidden-accounts";

/** Reads a persisted array of account ids from localStorage, returning [] on SSR or any parse error. */
function readIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** Persists an array of account ids to localStorage under the given key. */
function writeIds(key: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(ids));
}

/** Account ids the user has pinned to the dashboard's compact balances card. */
export function readPinnedAccountIds(): string[] {
  return readIds(PINNED_KEY);
}

/** Saves the pinned account ids. */
export function writePinnedAccountIds(ids: string[]): void {
  writeIds(PINNED_KEY, ids);
}

/** Account ids the user has hidden from the full /accounts list. */
export function readHiddenAccountIds(): string[] {
  return readIds(HIDDEN_KEY);
}

/** Saves the hidden account ids. */
export function writeHiddenAccountIds(ids: string[]): void {
  writeIds(HIDDEN_KEY, ids);
}
