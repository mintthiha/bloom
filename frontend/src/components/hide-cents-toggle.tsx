"use client";
import { Coins, Banknote } from "lucide-react";
import { useDisplayPreferences } from "./display-preferences-provider";

/** Header button that toggles whether balances show cents (e.g. $1,235 vs $1,234.56). */
export function HideCentsToggle() {
  const { hideCents, toggleHideCents } = useDisplayPreferences();
  const Icon = hideCents ? Banknote : Coins;

  return (
    <button
      type="button"
      onClick={toggleHideCents}
      aria-label={
        hideCents ? "Showing rounded balances. Show cents." : "Showing cents. Hide cents."
      }
      title={hideCents ? "Showing rounded balances" : "Showing cents"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "1px solid var(--border)",
        background: "transparent",
        color: hideCents ? "var(--text-primary)" : "var(--text-secondary)",
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
        e.currentTarget.style.color = hideCents ? "var(--text-primary)" : "var(--text-secondary)";
      }}
    >
      <Icon size={14} />
    </button>
  );
}
