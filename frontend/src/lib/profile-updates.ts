import type { Profile } from "./api";

/**
 * Tiny in-memory pub/sub for "the profile was just saved".
 *
 * The header's `ProfileMenu` lives in the app shell while the profile form lives inside a
 * route, so neither can pass props to the other. Without this, the header avatar kept showing
 * the previously loaded name/colour until a full page refresh re-ran its own fetch.
 */
type ProfileUpdateListener = (profile: Profile) => void;

const profileUpdateListeners = new Set<ProfileUpdateListener>();

/** Registers a listener for profile saves and returns its unsubscribe function. */
export function subscribeToProfileUpdates(listener: ProfileUpdateListener): () => void {
  profileUpdateListeners.add(listener);
  return () => {
    profileUpdateListeners.delete(listener);
  };
}

/**
 * Notifies every listener that a freshly saved profile is available. Iterates a snapshot so a
 * listener that unsubscribes (or subscribes) while handling the event cannot break the loop.
 */
export function publishProfileUpdate(profile: Profile): void {
  for (const listener of [...profileUpdateListeners]) {
    listener(profile);
  }
}
