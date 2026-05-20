"use client";
import { CSSProperties, ReactNode, useState } from "react";

type CollapsibleCardProps = {
  eyebrow: string;
  title?: string;
  description?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
  style?: CSSProperties;
  className?: string;
};

/** Chevron SVG that rotates 180° depending on collapsed state. */
function CollapseChevron({ isCollapsed }: { isCollapsed: boolean }) {
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
        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
        transition: "transform 0.25s ease",
        display: "block",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * Reusable dashboard card with a collapsible content area.
 * Animates via the grid-template-rows trick — no max-height hack needed.
 * headerRight renders beside the chevron and stays visible when collapsed.
 */
export function CollapsibleCard({
  eyebrow,
  title,
  description,
  headerRight,
  children,
  defaultCollapsed = false,
  style,
  className,
}: CollapsibleCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={className}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-secondary)",
              marginBottom: title ? "8px" : "0",
            }}
          >
            {eyebrow}
          </p>
          {title && (
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 800,
                letterSpacing: "-0.3px",
                marginBottom: description ? "6px" : "0",
              }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
              {description}
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
            paddingTop: "2px",
          }}
        >
          {headerRight}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? "Expand section" : "Collapse section"}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              borderRadius: "6px",
            }}
          >
            <CollapseChevron isCollapsed={isCollapsed} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateRows: isCollapsed ? "0fr" : "1fr",
          transition: "grid-template-rows 0.28s ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              paddingTop: "18px",
              opacity: isCollapsed ? 0 : 1,
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
