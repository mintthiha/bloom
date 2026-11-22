"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  DEFAULT_VISUAL_STYLE,
  parseVisualStyle,
  VISUAL_STYLE_ATTRIBUTE,
  VISUAL_STYLE_STORAGE_KEY,
  type VisualStyle,
} from "@/lib/visual-style";

const VisualStyleContext = createContext<{
  visualStyle: VisualStyle;
  setVisualStyle: (nextVisualStyle: VisualStyle) => void;
}>({
  visualStyle: DEFAULT_VISUAL_STYLE,
  setVisualStyle: () => {},
});

/**
 * Owns which look Bloom renders in (classic or extravagant). Persists the choice to localStorage
 * (device-level, like the theme) and mirrors it onto `<html>` as `data-visual-style`, which is the
 * single switch the extravagant stylesheet and effects layer hang off.
 */
export function VisualStyleProvider({ children }: { children: React.ReactNode }) {
  const [visualStyle, setVisualStyleState] = useState<VisualStyle>(DEFAULT_VISUAL_STYLE);

  /** Restores the saved look after hydration; the head script has already styled the page. */
  useEffect(() => {
    setVisualStyleState(parseVisualStyle(localStorage.getItem(VISUAL_STYLE_STORAGE_KEY)));
  }, []);

  /** Keeps the document attribute in step with the chosen look. */
  useEffect(() => {
    document.documentElement.setAttribute(VISUAL_STYLE_ATTRIBUTE, visualStyle);
  }, [visualStyle]);

  /** Switches the look and saves it for the next visit. */
  const setVisualStyle = useCallback((nextVisualStyle: VisualStyle) => {
    setVisualStyleState(nextVisualStyle);
    try {
      localStorage.setItem(VISUAL_STYLE_STORAGE_KEY, nextVisualStyle);
    } catch {
      // Storage can be unavailable (private mode); the look still applies for this visit.
    }
  }, []);

  return (
    <VisualStyleContext.Provider value={{ visualStyle, setVisualStyle }}>
      {children}
    </VisualStyleContext.Provider>
  );
}

/** Reads the current look and the setter that changes it. */
export function useVisualStyle() {
  return useContext(VisualStyleContext);
}
