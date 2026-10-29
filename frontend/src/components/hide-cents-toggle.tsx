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
      className="header-icon-button touch-target"
      data-active={hideCents}
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
        background: "transparent",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Icon size={14} />
    </button>
  );
}
