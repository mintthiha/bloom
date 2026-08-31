const AI_SUGGESTIONS_KEY = "bloom:ai-suggestions-enabled";

/** Returns whether AI category suggestions are enabled, defaulting to true if unset. */
export function getAiSuggestionsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(AI_SUGGESTIONS_KEY);
  return stored === null ? true : stored === "true";
}

/** Persists the AI category suggestions preference to localStorage. */
export function setAiSuggestionsEnabled(enabled: boolean): void {
  localStorage.setItem(AI_SUGGESTIONS_KEY, String(enabled));
}
