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

const ALL_STEPS_COMPLETE_KEY = "bloom_onboarding_all_steps_complete";

/** Reads whether the checklist auto-hid because all steps were finished. */
export function getOnboardingAllStepsComplete(): boolean {
  try {
    return localStorage.getItem(ALL_STEPS_COMPLETE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Records that the checklist auto-hid due to all steps being complete. */
export function setOnboardingAllStepsComplete(): void {
  try {
    localStorage.setItem(ALL_STEPS_COMPLETE_KEY, "true");
  } catch {
    // ignore storage errors
  }
}

/** Clears the all-steps-complete flag so the checklist can be restored. */
export function clearOnboardingAllStepsComplete(): void {
  try {
    localStorage.removeItem(ALL_STEPS_COMPLETE_KEY);
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
