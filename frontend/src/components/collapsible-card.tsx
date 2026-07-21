"use client";
import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardVisibility } from "@/components/dashboard-visibility-provider";

type CollapsibleCardProps = {
  eyebrow: string;
  title?: string;
  description?: string;
  // A node, or a render function receiving the collapsed state so cards can hide wide/interactive
  // controls while collapsed (which would otherwise crush the title in the narrow tile).
  headerRight?: ReactNode | ((isCollapsed: boolean) => ReactNode);
  children: ReactNode;
  defaultCollapsed?: boolean;
  style?: CSSProperties;
  className?: string;
};

/** Uniform height every card snaps to while collapsed so the dashboard grid reads as an even set of tiles. */
export const COLLAPSED_CARD_HEIGHT = 204;

/** Line-clamp styles applied to header text while collapsed so long titles/descriptions can't break the uniform height. */
function clampLines(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

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
 * The collapse chevron is pinned to the top-right corner; headerRight flows in the header row
 * (wrapping to its own line in narrow cards) and stays visible when collapsed.
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
  const { allCollapsed } = useDashboardVisibility();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed || allCollapsed);
  const isFirstRender = useRef(true);
  const isMobile = useIsMobile();

  /** Bulk-collapses or expands this card when the dashboard-wide toggle changes, leaving the initial mount to honor defaultCollapsed. */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setIsCollapsed(allCollapsed);
  }, [allCollapsed]);

  const headerRightContent =
    typeof headerRight === "function" ? headerRight(isCollapsed) : headerRight;

  return (
    <div
      className={["lift", className].filter(Boolean).join(" ")}
      style={{
        position: "relative",
        background: "var(--snapshot-gradient)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
        // While collapsed, every card locks to one height so the grid reads as an even set of tiles.
        // Skip on mobile, where cards stack full-width and the header wraps to its own column.
        height: isCollapsed && !isMobile ? `${COLLAPSED_CARD_HEIGHT}px` : undefined,
        overflow: isCollapsed && !isMobile ? "hidden" : undefined,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          // On desktop, let the header wrap so the right-hand controls drop onto their own line
          // in a narrow card instead of crushing the title column to a few pixels wide.
          flexWrap: isMobile ? undefined : "wrap",
          justifyContent: isMobile ? "flex-start" : "space-between",
          gap: isMobile ? "8px" : "16px",
          alignItems: isMobile ? "stretch" : "flex-start",
          // Reserve room for the absolutely-positioned chevron so header content never slides under it.
          paddingRight: "32px",
          // While collapsed on desktop, cap the header to the tile's inner height (minus the 24px
          // top+bottom padding) so long text clips above the bottom padding instead of touching the edge.
          maxHeight: isCollapsed && !isMobile ? `${COLLAPSED_CARD_HEIGHT - 48}px` : undefined,
          overflow: isCollapsed && !isMobile ? "hidden" : undefined,
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#3b82f6",
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
                ...(isCollapsed ? clampLines(2) : {}),
              }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "13px",
                ...(isCollapsed ? clampLines(2) : {}),
              }}
            >
              {description}
            </p>
          )}
        </div>

        {headerRightContent && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
              paddingTop: isMobile ? "0" : "2px",
              justifyContent: isMobile ? "flex-end" : undefined,
            }}
          >
            {headerRightContent}
          </div>
        )}
      </div>

      {/* Pinned to the card's top-right corner so it never rides along when the header wraps. */}
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-label={isCollapsed ? "Expand section" : "Collapse section"}
        style={{
          position: "absolute",
          top: "24px",
          right: "24px",
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
