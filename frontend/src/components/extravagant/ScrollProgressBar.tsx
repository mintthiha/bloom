"use client";

import { motion, useScroll, useSpring } from "motion/react";

/** A gradient bar pinned to the top of the viewport that fills, on a spring, as the page scrolls. */
export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const smoothedProgress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });

  return (
    <motion.div
      aria-hidden
      className="extravagant-scroll-progress"
      style={{ scaleX: smoothedProgress }}
    />
  );
}
