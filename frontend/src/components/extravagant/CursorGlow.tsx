"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

/** Diameter of the glow in px; the element is centred on the cursor by offsetting half of this. */
const GLOW_DIAMETER = 520;
const GLOW_SPRING = { stiffness: 120, damping: 22, mass: 0.6 };

/**
 * A soft pool of accent-coloured light that trails the cursor on a spring, sitting behind the page
 * content so it shows through the gaps and the translucent cards. Decorative only.
 */
export function CursorGlow() {
  const pointerX = useMotionValue(-GLOW_DIAMETER);
  const pointerY = useMotionValue(-GLOW_DIAMETER);
  const glowX = useSpring(pointerX, GLOW_SPRING);
  const glowY = useSpring(pointerY, GLOW_SPRING);

  /** Feeds the cursor position into the springs. */
  useEffect(() => {
    /** Moves the glow's target to the pointer, centred. */
    function handlePointerMove(event: PointerEvent) {
      pointerX.set(event.clientX - GLOW_DIAMETER / 2);
      pointerY.set(event.clientY - GLOW_DIAMETER / 2);
    }
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [pointerX, pointerY]);

  return (
    <motion.div
      aria-hidden
      className="extravagant-cursor-glow"
      style={{ x: glowX, y: glowY, width: GLOW_DIAMETER, height: GLOW_DIAMETER }}
    />
  );
}
