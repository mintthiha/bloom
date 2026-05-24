const CACHE_KEY = "bloom_profile_first_name";

/** Reads the cached first name from localStorage. Returns null if missing or unreadable. */
export function getCachedFirstName(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

/** Writes the first name to the localStorage cache. */
export function setCachedFirstName(firstName: string): void {
  try {
    localStorage.setItem(CACHE_KEY, firstName);
  } catch {
    // ignore storage errors
  }
}

/** Returns a time-appropriate greeting string. */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}
