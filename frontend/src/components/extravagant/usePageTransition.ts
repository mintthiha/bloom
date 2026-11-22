"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { animate } from "motion/react";

/** Marks the element in the app shell that wraps the routed page. */
export const PAGE_CONTENT_ATTRIBUTE = "data-page-content";

/**
 * Removes the inline styles the transition leaves behind. A lingering `transform` would make the
 * wrapper the containing block for any `position: fixed` descendant (e.g. an in-page dialog
 * overlay), so the page must end up exactly as it is in the classic look.
 */
function clearTransitionStyles(pageContent: HTMLElement) {
  pageContent.style.removeProperty("transform");
  pageContent.style.removeProperty("opacity");
  pageContent.style.removeProperty("will-change");
}

/**
 * Plays a rise-and-settle entrance on the routed page every time the path changes (and once when
 * the extravagant look is switched on). Runs as a layout effect so the new page starts hidden
 * rather than flashing in at full opacity before the animation begins.
 */
export function usePageTransition(isEnabled: boolean) {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (!isEnabled) return;
    const pageContent = document.querySelector<HTMLElement>(`[${PAGE_CONTENT_ATTRIBUTE}]`);
    if (!pageContent) return;

    const transition = animate(
      pageContent,
      { opacity: [0, 1], y: [36, 0], scale: [0.98, 1] },
      { type: "spring", stiffness: 170, damping: 22, mass: 0.9 }
    );
    transition.then(() => clearTransitionStyles(pageContent));

    return () => {
      transition.stop();
      clearTransitionStyles(pageContent);
    };
  }, [pathname, isEnabled]);
}
