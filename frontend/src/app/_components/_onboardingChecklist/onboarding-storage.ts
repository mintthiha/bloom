const DISMISSED_KEY = "bloom_onboarding_dismissed";
const LEARN_EXPLORED_KEY = "bloom_onboarding_learn_explored";

/** Reads whether the user has permanently dismissed the onboarding checklist. Returns false if unreadable. */
export function getOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Writes the permanent dismissal flag to localStorage. */
export function setOnboardingDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, "true");
  } catch {
    // ignore storage errors
  }
}

/** Removes the dismissal flag so the checklist becomes visible again. */
export function clearOnboardingDismissed(): void {
  try {
    localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // ignore storage errors
  }
}

/** Reads whether the user has visited the Learn page at least once. Returns false if unreadable. */
export function getLearnPageExplored(): boolean {
  try {
    return localStorage.getItem(LEARN_EXPLORED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Writes the Learn-page-explored flag to localStorage. */
export function setLearnPageExplored(): void {
  try {
    localStorage.setItem(LEARN_EXPLORED_KEY, "true");
  } catch {
    // ignore storage errors
  }
}
