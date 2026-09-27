// Per-user localStorage keys that must not leak between accounts on a shared browser (dashboard
// layout, onboarding progress, cached name, pinned goal, custom templates). Appearance keys
// (theme, dashboard view, collapse, orbs) are intentionally excluded so they persist across logins.
export const PER_USER_STORAGE_KEYS = [
  "bloom_profile_first_name",
  "bloom-account-order",
  "bloom_learn_explored",
  "bloom_dashboard_visible_cards",
  "bloom_dashboard_card_order",
  "bloom_dashboard_explained_cards",
  "bloom_goal_widget_id",
  "bloom_onboarding_dismissed",
  "bloom_onboarding_all_steps_complete",
  "bloom_onboarding_learn_explored",
  "bloom-custom-reward-programs",
  "bloom_saved_account",
];

/** Marker holding the id of the account whose preferences currently occupy localStorage. */
export const ACTIVE_USER_STORAGE_KEY = "bloom_active_user";

/**
 * Wipes every per-user preference plus the active-user marker. Called when an account is deleted:
 * the layout's reset script only fires when a *different* user signs in, so without this a deleted
 * user who signs back in (a Google account keeps the same id) would inherit the dashboard layout,
 * onboarding flags, and saved sign-in of the account they just erased.
 */
export function clearPerUserStorage(): void {
  try {
    for (const key of PER_USER_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); there is nothing to clean up then.
  }
}
