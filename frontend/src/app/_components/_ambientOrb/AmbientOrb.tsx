"use client";

import { useEffect, useRef, useState } from "react";

// Physics tuning — kept identical to the login orbs so the motion feels the same.
const INFLUENCE_RADIUS = 200; // cursor distance at which repulsion kicks in — smaller = get closer first
const PUSH_ACCEL = 2.4; // peak shove strength when the cursor is right next to an orb
const FRICTION = 0.965; // velocity retained each frame — higher = coasts/decelerates more gradually
const MAX_SPEED = 30; // cap so a close cursor can't fling one uncontrollably fast
const AMBIENT_SPEED = 0.4; // baseline drift speed — orbs float forever and never fully stop
const AMBIENT_JITTER = 0.03; // tiny random nudge each frame so the drift wanders organically
const EDGE_MARGIN = 20; // keep each orb's center at least this far inside the play area
const BOUNCE = 0.6; // energy kept after bouncing off an edge or another orb (0 = dead stop, 1 = perfect)

type Orb = {
  size: number; // rendered diameter in px
  radius: number; // collision radius (roughly the visible core)
  color: string; // "r,g,b" amber/gold tint
  alphaDark: number; // opacity on the dark theme
  alphaLight: number; // opacity on the light theme — higher, since amber washes out on white
};

/** The ambient orbs. Each is repelled by the cursor and bounces off the others and the edges. */
const ORBS: Orb[] = [
  { size: 360, radius: 108, color: "245,158,11", alphaDark: 0.12, alphaLight: 0.26 },
  { size: 260, radius: 78, color: "251,191,36", alphaDark: 0.1, alphaLight: 0.24 },
  { size: 200, radius: 60, color: "234,179,8", alphaDark: 0.09, alphaLight: 0.22 },
  { size: 320, radius: 96, color: "245,158,11", alphaDark: 0.1, alphaLight: 0.24 },
  { size: 150, radius: 45, color: "251,191,36", alphaDark: 0.11, alphaLight: 0.26 },
  { size: 290, radius: 87, color: "234,179,8", alphaDark: 0.08, alphaLight: 0.2 },
  { size: 180, radius: 54, color: "245,158,11", alphaDark: 0.11, alphaLight: 0.26 },
  { size: 230, radius: 69, color: "251,191,36", alphaDark: 0.09, alphaLight: 0.22 },
  { size: 130, radius: 39, color: "234,179,8", alphaDark: 0.12, alphaLight: 0.28 },
  { size: 340, radius: 102, color: "245,158,11", alphaDark: 0.08, alphaLight: 0.2 },
];

/** Builds an orb's radial-gradient fill for the current theme. */
function orbBackground(orb: Orb, isDark: boolean): string {
  const alpha = isDark ? orb.alphaDark : orb.alphaLight;
  return `radial-gradient(circle, rgba(${orb.color},${alpha}), transparent 70%)`;
}

type PlayArea = { left: number; top: number; width: number; height: number };

/**
 * Reads the live content region that bounds the orbs: right of the sidebar, below the sticky
 * header, and above the footer. Recomputed each frame so it tracks scrolling and resizing.
 */
function readPlayArea(): PlayArea | null {
  const main = document.querySelector("main");
  if (!main) return null;
  const mainRect = main.getBoundingClientRect();
  const header = document.querySelector("header");
  const footer = document.querySelector("footer");
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
  const top = Math.max(mainRect.top, headerBottom);
  const bottom = Math.min(mainRect.bottom, window.innerHeight, footerTop);
  return {
    left: mainRect.left,
    top,
    width: Math.max(0, mainRect.right - mainRect.left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * Ambient glow orbs that drift through the dashboard's content region, are repelled by the cursor,
 * and bounce off one another and the edges formed by the sidebar, header, and footer. Decorative.
 */
export function AmbientOrb() {
  const layerRef = useRef<HTMLDivElement>(null);
  const orbElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const orbStateRef = useRef(ORBS.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 })));
  const cursorRef = useRef({ x: 0, y: 0 });
  // Orbs stay invisible until the physics effect places them at their random spawns, so no flash.
  const [started, setStarted] = useState(false);
  // The theme drives orb opacity — amber needs to be stronger on the light background.
  const [isDark, setIsDark] = useState(true);

  /** Tracks the current theme via the `dark` class so the orbs restyle live when it's toggled. */
  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  /** Tracks the cursor in viewport coordinates so the physics loop can repel the orbs. */
  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      cursorRef.current = { x: event.clientX, y: event.clientY };
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  /** Physics loop: cursor repulsion + momentum, orb-vs-orb elastic collisions, and edge bounce. */
  useEffect(() => {
    const states = orbStateRef.current;

    /** Sizes the clipping layer to the play area, in viewport coordinates. */
    function positionLayer(area: PlayArea) {
      const layer = layerRef.current;
      if (!layer) return;
      layer.style.left = `${area.left}px`;
      layer.style.top = `${area.top}px`;
      layer.style.width = `${area.width}px`;
      layer.style.height = `${area.height}px`;
    }

    /** Paints each orb centered on its (x, y) within the layer. */
    function render() {
      states.forEach((state, i) => {
        const el = orbElsRef.current[i];
        if (el) {
          el.style.transform = `translate(${state.x - ORBS[i].size / 2}px, ${state.y - ORBS[i].size / 2}px)`;
        }
      });
    }

    // Spawn each orb at a random spot within the play area, drifting in a random direction.
    const initialArea = readPlayArea();
    if (initialArea) {
      states.forEach((state) => {
        state.x = EDGE_MARGIN + Math.random() * Math.max(1, initialArea.width - 2 * EDGE_MARGIN);
        state.y = EDGE_MARGIN + Math.random() * Math.max(1, initialArea.height - 2 * EDGE_MARGIN);
        const angle = Math.random() * Math.PI * 2;
        state.vx = Math.cos(angle) * AMBIENT_SPEED;
        state.vy = Math.sin(angle) * AMBIENT_SPEED;
      });
      positionLayer(initialArea);
      render();
    }

    // Reveal now that the orbs are positioned — this is what prevents the first-paint flash.
    setStarted(true);

    // Under reduced motion the orbs stay at their random spawns — no drift loop.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = requestAnimationFrame(function step() {
      const area = readPlayArea();
      if (area) {
        positionLayer(area);

        // Cursor position relative to the play area; only repels while inside it.
        const cursorX = cursorRef.current.x - area.left;
        const cursorY = cursorRef.current.y - area.top;
        const cursorInside =
          cursorX >= 0 && cursorX <= area.width && cursorY >= 0 && cursorY <= area.height;

        // 1. Per orb: cursor repulsion, drift jitter, friction, speed clamp, then integrate.
        states.forEach((state) => {
          if (cursorInside) {
            const dx = state.x - cursorX;
            const dy = state.y - cursorY;
            const distance = Math.hypot(dx, dy) || 1;
            if (distance < INFLUENCE_RADIUS) {
              // Quadratic falloff: the closer the cursor, the sharply faster it accelerates away.
              const proximity = 1 - distance / INFLUENCE_RADIUS;
              const push = proximity * proximity * PUSH_ACCEL;
              state.vx += (dx / distance) * push;
              state.vy += (dy / distance) * push;
            }
          }

          // Gentle random wander so the drift never looks perfectly straight.
          state.vx += (Math.random() - 0.5) * AMBIENT_JITTER;
          state.vy += (Math.random() - 0.5) * AMBIENT_JITTER;

          state.vx *= FRICTION;
          state.vy *= FRICTION;

          // Keep speed within [ambient floor, max]: never fully stops, never flings.
          const speed = Math.hypot(state.vx, state.vy);
          if (speed > MAX_SPEED) {
            state.vx = (state.vx / speed) * MAX_SPEED;
            state.vy = (state.vy / speed) * MAX_SPEED;
          } else if (speed < AMBIENT_SPEED) {
            if (speed < 0.0001) {
              const angle = Math.random() * Math.PI * 2;
              state.vx = Math.cos(angle) * AMBIENT_SPEED;
              state.vy = Math.sin(angle) * AMBIENT_SPEED;
            } else {
              state.vx = (state.vx / speed) * AMBIENT_SPEED;
              state.vy = (state.vy / speed) * AMBIENT_SPEED;
            }
          }

          state.x += state.vx;
          state.y += state.vy;
        });

        // 2. Elastic collisions between every pair of orbs (equal mass).
        for (let i = 0; i < ORBS.length; i++) {
          for (let j = i + 1; j < ORBS.length; j++) {
            const a = states[i];
            const b = states[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.hypot(dx, dy) || 0.0001;
            const minDistance = ORBS[i].radius + ORBS[j].radius;
            if (distance >= minDistance) continue;

            const nx = dx / distance;
            const ny = dy / distance;

            // Separate them so they no longer overlap (split evenly).
            const overlap = (minDistance - distance) / 2;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;

            // Exchange velocity along the collision normal (only if closing in).
            const velAlongNormal = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (velAlongNormal < 0) {
              const impulse = (-(1 + BOUNCE) * velAlongNormal) / 2;
              a.vx -= impulse * nx;
              a.vy -= impulse * ny;
              b.vx += impulse * nx;
              b.vy += impulse * ny;
            }
          }
        }

        // 3. Bounce off the play-area edges (sidebar / header / footer / viewport), then paint.
        states.forEach((state) => {
          const minX = EDGE_MARGIN;
          const maxX = Math.max(EDGE_MARGIN, area.width - EDGE_MARGIN);
          const minY = EDGE_MARGIN;
          const maxY = Math.max(EDGE_MARGIN, area.height - EDGE_MARGIN);
          if (state.x < minX) {
            state.x = minX;
            state.vx = Math.abs(state.vx) * BOUNCE;
          } else if (state.x > maxX) {
            state.x = maxX;
            state.vx = -Math.abs(state.vx) * BOUNCE;
          }
          if (state.y < minY) {
            state.y = minY;
            state.vy = Math.abs(state.vy) * BOUNCE;
          } else if (state.y > maxY) {
            state.y = maxY;
            state.vy = -Math.abs(state.vy) * BOUNCE;
          }
        });

        render();
      }
      frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {ORBS.map((orb, index) => (
        <div
          key={index}
          ref={(el) => {
            orbElsRef.current[index] = el;
          }}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${orb.size}px`,
            height: `${orb.size}px`,
            borderRadius: "50%",
            background: orbBackground(orb, isDark),
            willChange: "transform",
            opacity: started ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        />
      ))}
    </div>
  );
}
