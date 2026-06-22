"use client";
import { useEffect, useRef, useState } from "react";

interface AnimatedCountProps {
  value: number;
  duration?: number;
}

/** Counts from 0 to value on mount using easeOutCubic, rendered as a rounded integer. Instant when prefers-reduced-motion is set. */
export function AnimatedCount({ value, duration = 500 }: AnimatedCountProps) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || value === 0) {
      setDisplayed(value);
      return;
    }

    const startTime = performance.now();

    /** Advances the animation one frame, scheduling the next until complete. */
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(value * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(value);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{displayed}</>;
}
