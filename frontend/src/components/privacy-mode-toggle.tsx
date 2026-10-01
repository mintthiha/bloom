"use client";
import { Eye, EyeOff } from "lucide-react";
import { useDisplayPreferences } from "./display-preferences-provider";

/** Header button that toggles privacy mode, which blurs balances until hovered. */
export function PrivacyModeToggle() {
  const { privacyMode, togglePrivacyMode } = useDisplayPreferences();
  const Icon = privacyMode ? EyeOff : Eye;

  return (
    <button
      type="button"
      onClick={togglePrivacyMode}
      aria-label={
        privacyMode ? "Privacy mode on. Balances are blurred. Turn off." : "Turn on privacy mode."
      }
      title={privacyMode ? "Privacy mode on" : "Privacy mode off"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "1px solid var(--border)",
        background: "transparent",
        color: privacyMode ? "var(--text-primary)" : "var(--text-secondary)",
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
        e.currentTarget.style.color = privacyMode ? "var(--text-primary)" : "var(--text-secondary)";
      }}
    >
      <Icon size={14} />
    </button>
  );
}
