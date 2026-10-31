import type { CSSProperties } from "react";
import type { OrbBody } from "./orb-physics";

/** A showcase orb: its physics body plus how it is drawn. */
export type ShowcaseOrb = OrbBody & {
  size: number; // rendered diameter in px
  background: string; // radial-gradient fill
  entranceDelay: string; // stagger for the scale-in animation
  anchor: CSSProperties; // CSS resting position, so the first paint is correct with no JS (avoids a flash) — must match `rest`
};

/** The two floating showcase orbs. Both are repelled by the cursor and bounce off each other and the edges. */
export const SHOWCASE_ORBS: ShowcaseOrb[] = [
  {
    size: 440,
    radius: 130,
    background:
      "radial-gradient(circle, color-mix(in srgb, var(--brand-accent) 16%, transparent), transparent 70%)",
    entranceDelay: "0s",
    anchor: { top: "-140px", right: "-120px" },
    rest: (bounds) => ({ x: bounds.width - 100, y: 80 }),
  },
  {
    size: 300,
    radius: 92,
    background: "radial-gradient(circle, rgba(251,191,36,0.13), transparent 70%)",
    entranceDelay: "0.18s",
    anchor: { bottom: "-30px", left: "-20px" },
    rest: (bounds) => ({ x: 130, y: bounds.height - 120 }),
  },
];
