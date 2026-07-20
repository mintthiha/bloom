"use client";
import { ReactNode } from "react";

type Props = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** Chevron SVG that rotates to point down when the section is open and right when collapsed. */
function SectionChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 0.25s ease",
        display: "block",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Controlled collapsible region with a clickable header and the same grid-template-rows
 * animation the dashboard cards use. The parent owns `open` so it can force the section
 * expanded (e.g. when the user starts editing an existing rule).
 */
export function CollapsibleFormSection({ title, open, onToggle, children }: Props) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "12px 14px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          cursor: "pointer",
          color: "var(--text-primary)",
          fontSize: "14px",
          fontWeight: 700,
        }}
      >
        <span>{title}</span>
        <span style={{ color: "var(--text-muted)", display: "flex" }}>
          <SectionChevron open={open} />
        </span>
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 0.28s ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              paddingTop: "16px",
              opacity: open ? 1 : 0,
              transition: "opacity 0.2s ease",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
