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
      aria-label={`${THEME_LABELS[theme]}. Switch to ${NEXT_THEME_LABELS[theme]} mode.`}
      title={THEME_LABELS[theme]}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text-secondary)",
        cursor: "pointer",
        transition: "border-color 0.15s, color 0.15s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-hover)";
        e.currentTarget.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = "var(--text-secondary)";
      }}
    >
      <Icon size={14} />
    </button>
  );
}
