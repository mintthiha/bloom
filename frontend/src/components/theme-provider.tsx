"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "bloom-theme";

/** Reads the OS-level color scheme preference. */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}>({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
  cycleTheme: () => {},
});

/**
 * Manages the active theme preference (light/dark/system), persists it to localStorage, resolves
 * "system" against the OS `prefers-color-scheme` setting (tracking live changes), and applies the
 * `dark` class to the document root.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") setThemeState(stored);
  }, []);

  useEffect(() => {
    /** Recomputes the resolved theme (following the OS preference when set to "system") and applies it. */
    function applyResolvedTheme() {
      const next = theme === "system" ? getSystemTheme() : theme;
      setResolvedTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    }

    applyResolvedTheme();
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", applyResolvedTheme);
    return () => media.removeEventListener("change", applyResolvedTheme);
  }, [theme]);

  /** Sets the theme preference directly. */
  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  /** Cycles the theme preference: system -> light -> dark -> system. */
  const cycleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "system" ? "light" : prev === "light" ? "dark" : "system"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
