"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const HIDE_CENTS_STORAGE_KEY = "bloom-hide-cents";
const PRIVACY_MODE_STORAGE_KEY = "bloom-privacy-mode";

const DisplayPreferencesContext = createContext<{
  hideCents: boolean;
  toggleHideCents: () => void;
  privacyMode: boolean;
  togglePrivacyMode: () => void;
}>({
  hideCents: false,
  toggleHideCents: () => {},
  privacyMode: false,
  togglePrivacyMode: () => {},
});

/**
 * Manages the "hide cents" and "privacy mode" display preferences, persisting each to
 * localStorage (device-level, like the theme preference) so they survive across logins.
 */
export function DisplayPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [hideCents, setHideCents] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);

  useEffect(() => {
    setHideCents(localStorage.getItem(HIDE_CENTS_STORAGE_KEY) === "true");
    setPrivacyMode(localStorage.getItem(PRIVACY_MODE_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-privacy-mode", privacyMode ? "on" : "off");
  }, [privacyMode]);

  /** Flips the hide-cents preference and persists it. */
  const toggleHideCents = useCallback(() => {
    setHideCents((prev) => {
      const next = !prev;
      localStorage.setItem(HIDE_CENTS_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  /** Flips the privacy-mode preference and persists it. */
  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <DisplayPreferencesContext.Provider
      value={{ hideCents, toggleHideCents, privacyMode, togglePrivacyMode }}
    >
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

export function useDisplayPreferences() {
  return useContext(DisplayPreferencesContext);
}
