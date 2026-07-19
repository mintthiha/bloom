"use client";

import { Search } from "lucide-react";
import { openCommandPalette } from "@/components/CommandPalette";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Centered header trigger that opens the command palette. Renders as a full search
 * field on desktop and collapses to an icon-only button on mobile to save space.
 */
export function HeaderSearch() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Search transactions"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "var(--surface-1)",
          color: "var(--text-secondary)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Search size={15} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Search transactions"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        maxWidth: "420px",
        height: "36px",
        padding: "0 12px",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        background: "var(--surface-1)",
        color: "var(--text-muted)",
        cursor: "pointer",
        transition: "border-color 0.15s, color 0.15s",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = "var(--border-hover)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <Search size={15} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: "13px", flex: 1, textAlign: "left" }}>Search transactions…</span>
      <kbd
        style={{
          fontSize: "10px",
          padding: "1px 5px",
          borderRadius: "4px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          fontFamily: "inherit",
        }}
      >
        ⌘K
      </kbd>
    </button>
  );
}
