"use client";

import { useEffect } from "react";

/** Cards opt into the spotlight simply by carrying the shared `.lift` class. */
const SPOTLIGHT_CARD_SELECTOR = ".lift";

/**
 * Tracks the cursor over any `.lift` card and publishes its position as `--spotlight-x` /
 * `--spotlight-y` on that card, which the extravagant stylesheet turns into a light that follows
 * the pointer. One delegated listener serves every card, throttled to one write per frame.
 */
export function useCardSpotlight() {
  useEffect(() => {
    let frameId = 0;
    let latestEvent: PointerEvent | null = null;

    /** Writes the most recent pointer position onto the card under it. */
    function applySpotlight() {
      frameId = 0;
      const target = latestEvent?.target;
      if (!latestEvent || !(target instanceof Element)) return;
      const card = target.closest<HTMLElement>(SPOTLIGHT_CARD_SELECTOR);
      if (!card) return;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty("--spotlight-x", `${latestEvent.clientX - bounds.left}px`);
      card.style.setProperty("--spotlight-y", `${latestEvent.clientY - bounds.top}px`);
    }

    /** Remembers the latest pointer event and schedules a single write for the next frame. */
    function handlePointerMove(event: PointerEvent) {
      latestEvent = event;
      if (frameId === 0) frameId = requestAnimationFrame(applySpotlight);
    }

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);
}
