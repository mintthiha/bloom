"use client";

import { useReducedMotion } from "motion/react";
import { AuroraBackdrop } from "./AuroraBackdrop";
import { ClickSparks } from "./ClickSparks";
import { CursorGlow } from "./CursorGlow";
import { ScrollProgressBar } from "./ScrollProgressBar";
import { useCardSpotlight } from "./useCardSpotlight";
import { usePageTransition } from "./usePageTransition";

/**
 * Everything the extravagant look adds on top of the stylesheet: the aurora backdrop, the cursor
 * glow, click sparks, the scroll progress bar, the card spotlight, and page transitions. Mounted
 * by the app shell only while that look is on (and code-split, so the classic look never downloads
 * the animation library). Under the OS "reduce motion" setting only the static pieces remain.
 */
export default function ExtravagantEffects() {
  const shouldReduceMotion = useReducedMotion() ?? false;

  useCardSpotlight();
  usePageTransition(!shouldReduceMotion);

  return (
    <>
      <AuroraBackdrop />
      <ScrollProgressBar />
      {!shouldReduceMotion && <CursorGlow />}
      {!shouldReduceMotion && <ClickSparks />}
    </>
  );
}
