"use client";
import { CSSProperties, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  /** When true, forces the card open regardless of its current collapsed state. */
  forceExpanded?: boolean;
  style?: CSSProperties;
  className?: string;
  // "data" (default) renders a filled tile for read-only insights; "action" renders a dashed,
  // flat-fill tile so account-management actions read as a distinct class from the data cards.
  variant?: "data" | "action";
  // Optional leading glyph, shown as a tinted chip above the eyebrow. Used by action cards to
  // signal their affordance (add / link) at a glance.
  icon?: ReactNode;
};

/** Uniform height every card snaps to while collapsed so the dashboard grid reads as an even set of tiles. */
export const COLLAPSED_CARD_HEIGHT = 204;

/** Total time the collapse animation takes (opacity fade + delay + grid-row shrink), in ms. Used to defer the hard height/overflow snap until the shrink has actually finished. */
const COLLAPSE_ANIMATION_DURATION_MS = 550;

/** Time to wait before releasing the tile's explicit height back to "auto" after expanding — the 0.4s grow transition plus a small buffer for the double-rAF start delay. */
const EXPAND_ANIMATION_DURATION_MS = 450;

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
        transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
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
  forceExpanded = false,
  style,
  className,
  variant = "data",
  icon,
}: CollapsibleCardProps) {
  const isAction = variant === "action";
  const { allCollapsed } = useDashboardVisibility();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed || allCollapsed);
  // Tracks whether the tile is allowed to snap to the fixed collapsed height/overflow/clamped
  // header. Kept a beat behind `isCollapsed` on collapse so the outer tile doesn't clip its
  // content before the inner shrink animation has actually finished playing.
  const [isHeightLocked, setIsHeightLocked] = useState(defaultCollapsed || allCollapsed);
  const isFirstRender = useRef(true);
  const isMobile = useIsMobile();

  const cardRef = useRef<HTMLDivElement>(null);
  const contentRowRef = useRef<HTMLDivElement>(null);
  const [explicitHeight, setExplicitHeight] = useState<number | undefined>(() =>
    !isMobile && (defaultCollapsed || allCollapsed) ? COLLAPSED_CARD_HEIGHT : undefined
  );
  const isFirstHeightRender = useRef(true);
  const frameRef = useRef(0);
  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Bulk-collapses or expands this card when the dashboard-wide toggle changes, leaving the initial mount to honor defaultCollapsed. */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setIsCollapsed(allCollapsed);
  }, [allCollapsed]);

  /**
   * Expanding unlocks the header's clamp/clip immediately so it can grow; collapsing only locks it
   * once the shrink animation has finished playing, avoiding an instant clip. This runs as a
   * layout effect (not a passive one) so the header is already unclamped, synchronously, before
   * the height-measurement effect below reads the tile's natural expanded height — otherwise that
   * measurement would run one render too early, against the still-clamped header.
   */
  useLayoutEffect(() => {
    if (!isCollapsed) {
      setIsHeightLocked(false);
      return;
    }
    const timeout = setTimeout(() => setIsHeightLocked(true), COLLAPSE_ANIMATION_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [isCollapsed]);

  /**
   * Drives the tile's explicit pixel height so both directions animate as one continuous motion
   * instead of an instant jump followed by a correction:
   *  - Collapsing measures the tile's real current height (right before any collapse-driven style
   *    changes take visual effect, thanks to the CSS transition-delay below) and animates smoothly
   *    down to the fixed collapsed height.
   *  - Expanding briefly forces the content row open (with transitions suppressed) to measure the
   *    tile's true final height, then animates from the current collapsed height straight to that
   *    value, finally releasing back to "auto" once the animation finishes so the tile stays
   *    responsive to later content/window changes.
   *
   * Heights are measured fresh here rather than tracked in a background ref, because both the
   * expand growth and collapse shrink are pure CSS animations — no React render fires while they
   * play, so a ref updated only on render would go stale at whatever height the tile had at the
   * instant the animation started, not its true target height.
   */
  useLayoutEffect(() => {
    clearTimeout(releaseTimeoutRef.current);
    if (isMobile) {
      setExplicitHeight(undefined);
      return;
    }
    if (isFirstHeightRender.current) {
      isFirstHeightRender.current = false;
      return;
    }
    if (isCollapsed) {
      const startHeight = cardRef.current?.getBoundingClientRect().height ?? COLLAPSED_CARD_HEIGHT;
      setExplicitHeight(startHeight);
      // A single rAF can land before the browser has actually painted the starting height, which
      // collapses both updates into one frame and skips the transition entirely. Waiting for a
      // second rAF guarantees a real paint of the starting value happens first.
      const outerFrame = requestAnimationFrame(() => {
        const innerFrame = requestAnimationFrame(() => setExplicitHeight(COLLAPSED_CARD_HEIGHT));
        frameRef.current = innerFrame;
      });
      frameRef.current = outerFrame;
      return () => cancelAnimationFrame(frameRef.current);
    }

    // The header's clamp/clip unlocks in the layout effect above, one render ahead of this one.
    // Bail out on the transitional render where that hasn't landed yet — it'll fire again, with
    // `isHeightLocked` in the dependency array, once the header has actually unclamped, so the
    // measurement below reads its true final size instead of the still-clamped one.
    if (isHeightLocked) return;

    const cardEl = cardRef.current;
    const rowEl = contentRowRef.current;
    let targetHeight = cardEl?.getBoundingClientRect().height ?? COLLAPSED_CARD_HEIGHT;
    if (cardEl && rowEl) {
      // Momentarily let both the tile and its content row size to "auto"/"1fr" with no transition
      // to read the tile's true expanded height, then put everything right back — this all happens
      // within one synchronous pass, so nothing paints in between and there's no visible flash.
      // (The tile's own height is normally pinned to an explicit pixel value, which would otherwise
      // stop it from growing to fit the forced-open row.)
      const previousCardTransition = cardEl.style.transition;
      const previousCardHeight = cardEl.style.height;
      const previousRowTransition = rowEl.style.transition;
      const previousRowGridTemplateRows = rowEl.style.gridTemplateRows;
      cardEl.style.transition = "none";
      cardEl.style.height = "auto";
      rowEl.style.transition = "none";
      rowEl.style.gridTemplateRows = "1fr";
      targetHeight = cardEl.getBoundingClientRect().height;
      cardEl.style.height = previousCardHeight;
      cardEl.style.transition = previousCardTransition;
      rowEl.style.gridTemplateRows = previousRowGridTemplateRows;
      rowEl.style.transition = previousRowTransition;
      void rowEl.offsetHeight;
    }

    setExplicitHeight(COLLAPSED_CARD_HEIGHT);
    const outerFrame = requestAnimationFrame(() => {
      const innerFrame = requestAnimationFrame(() => setExplicitHeight(targetHeight));
      frameRef.current = innerFrame;
    });
    frameRef.current = outerFrame;
    releaseTimeoutRef.current = setTimeout(
      () => setExplicitHeight(undefined),
      EXPAND_ANIMATION_DURATION_MS
    );
    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(releaseTimeoutRef.current);
    };
  }, [isCollapsed, isMobile, isHeightLocked]);

  /** Opens the card whenever an external caller signals that new content needs to be visible. */
  useEffect(() => {
    if (forceExpanded) setIsCollapsed(false);
  }, [forceExpanded]);

  const headerRightContent =
    typeof headerRight === "function" ? headerRight(isCollapsed) : headerRight;

  return (
    <div
      ref={cardRef}
      className={["lift", className].filter(Boolean).join(" ")}
      style={{
        position: "relative",
        // Action cards drop the filled gradient for a flat, dashed "add-slot" treatment so they
        // read as a separate class from the data tiles above them.
        background: isAction ? "transparent" : "var(--snapshot-gradient)",
        border: isAction ? "1px dashed var(--border-hover)" : "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
        // While collapsed, every card locks to one height so the grid reads as an even set of tiles.
        // Skip on mobile, where cards stack full-width and the header wraps to its own column.
        // `explicitHeight` carries a real pixel value only while collapsed (or mid-collapse), so it
        // can be transitioned smoothly instead of snapping straight to the fixed height.
        height: explicitHeight !== undefined ? `${explicitHeight}px` : undefined,
        // Keep the height transition in lockstep with the inner content's grid-row animation so
        // the tile's bottom edge moves as one continuous motion in both directions: delayed to
        // match the content fading out first on collapse, immediate to match the row growing
        // right away on expand.
        transition:
          explicitHeight !== undefined
            ? isCollapsed
              ? "height 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.15s"
              : "height 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
            : undefined,
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
          maxHeight: isHeightLocked && !isMobile ? `${COLLAPSED_CARD_HEIGHT - 48}px` : undefined,
          overflow: isHeightLocked && !isMobile ? "hidden" : undefined,
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          {icon && (
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--brand-accent) 20%, transparent)",
                color: "var(--brand-accent)",
                marginBottom: "12px",
              }}
            >
              {icon}
            </span>
          )}
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--brand-accent)",
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
                ...(isHeightLocked ? clampLines(2) : {}),
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
                ...(isHeightLocked ? clampLines(2) : {}),
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
              marginLeft: "auto",
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
        ref={contentRowRef}
        style={{
          display: "grid",
          gridTemplateRows: isCollapsed ? "0fr" : "1fr",
          // On collapse, wait for the content to fade out (below) before shrinking the row, mirroring
          // the expand sequencing so open and close read as the same animation in reverse.
          transition: isCollapsed
            ? "grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.15s"
            : "grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div style={{ overflow: isCollapsed ? "hidden" : "visible", minHeight: 0 }}>
          <div
            style={{
              paddingTop: "18px",
              opacity: isCollapsed ? 0 : 1,
              // Fade in only after the tile has mostly opened, and fade out immediately on collapse,
              // so content never appears to pop in/out ahead of the grid animation finishing.
              transition: isCollapsed ? "opacity 0.15s ease" : "opacity 0.25s ease 0.15s",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
