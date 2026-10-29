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
      className="header-icon-button touch-target"
      data-active={privacyMode}
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
        background: "transparent",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Icon size={14} />
    </button>
  );
}
