"use client";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";

const THEME_LABELS = {
  system: "Using system theme",
  light: "Using light mode",
  dark: "Using dark mode",
} as const;

const NEXT_THEME_LABELS = {
  system: "light",
  light: "dark",
  dark: "system",
} as const;

/** Header button that cycles the theme preference: system -> light -> dark -> system. */
export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();

  const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="header-icon-button touch-target"
      aria-label={`${THEME_LABELS[theme]}. Switch to ${NEXT_THEME_LABELS[theme]} mode.`}
      title={THEME_LABELS[theme]}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        background: "transparent",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Icon size={14} />
    </button>
  );
}
