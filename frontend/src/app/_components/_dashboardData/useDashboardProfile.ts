import { useEffect, useRef, useState } from "react";
import { api, Profile } from "@/lib/api";
import { getCachedFirstName, setCachedFirstName } from "@/lib/profile-cache";

/**
 * Loads the user's profile for the greeting and the onboarding gate. The first name is seeded from
 * localStorage so the greeting doesn't flash, and re-cached whenever a real profile arrives.
 * A failed request calls `onLoadFailure` — it must never look like "no profile yet", which the
 * API reports as null and which sends the user to onboarding.
 */
export function useDashboardProfile(onLoadFailure: () => void) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [cachedFirstName, setCachedFirstNameState] = useState<string | null>(null);
  // The mount-only load below reports through the latest callback without re-running.
  const onLoadFailureRef = useRef(onLoadFailure);

  /** Points the ref at the newest failure callback. */
  useEffect(() => {
    onLoadFailureRef.current = onLoadFailure;
  }, [onLoadFailure]);

  /** Seeds the greeting name instantly from localStorage to avoid a flash on load. */
  useEffect(() => {
    const cached = getCachedFirstName();
    if (cached) setCachedFirstNameState(cached);
  }, []);

  /** Loads the user profile once on mount and caches its first name. */
  useEffect(() => {
    let isCancelled = false;

    async function loadProfile() {
      try {
        const nextProfile = await api.getProfile();
        if (isCancelled) return;
        setProfile(nextProfile);
        if (nextProfile?.firstName) {
          setCachedFirstName(nextProfile.firstName);
          setCachedFirstNameState(nextProfile.firstName);
        }
      } catch {
        if (!isCancelled) onLoadFailureRef.current();
      } finally {
        if (!isCancelled) setIsProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      isCancelled = true;
    };
  }, []);

  /** Adopts a profile just saved during onboarding, so the dashboard and greeting update at once. */
  function handleProfileSaved(savedProfile: Profile) {
    setProfile(savedProfile);
    if (savedProfile.firstName) {
      setCachedFirstName(savedProfile.firstName);
      setCachedFirstNameState(savedProfile.firstName);
    }
  }

  return { profile, isProfileLoading, cachedFirstName, handleProfileSaved };
}
