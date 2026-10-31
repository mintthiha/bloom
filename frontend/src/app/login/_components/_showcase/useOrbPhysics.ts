import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createOrbStates, spawnOrbs, stepOrbPhysics, type Cursor } from "./orb-physics";
import { SHOWCASE_ORBS } from "./showcase-orbs";

/**
 * Runs the showcase orbs: spawns them at random spots, then animates them every frame (unless the
 * user prefers reduced motion), repelled by the cursor tracked through the returned handlers.
 * The orbs stay invisible until `hasStarted`, so they never flash at their CSS resting spots.
 */
export function useOrbPhysics() {
  const panelRef = useRef<HTMLDivElement>(null);
  const orbElementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const orbStatesRef = useRef(createOrbStates(SHOWCASE_ORBS.length));
  const cursorRef = useRef<Cursor>({ x: 0, y: 0, active: false });
  const [hasStarted, setHasStarted] = useState(false);

  /** Records the cursor position within the panel so the physics loop can repel the orbs. */
  function handlePanelMouseMove(event: MouseEvent<HTMLDivElement>) {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    cursorRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      active: true,
    };
  }

  /** Stops repelling when the cursor leaves; orbs keep their momentum and coast to a stop. */
  function handlePanelMouseLeave() {
    cursorRef.current.active = false;
  }

  /** Spawns the orbs, reveals them, and runs the physics loop until unmount. */
  useEffect(() => {
    const states = orbStatesRef.current;

    /** Writes each orb's transform from its offset only; the CSS `anchor` already positions it at rest. */
    function render() {
      states.forEach((state, index) => {
        const element = orbElementsRef.current[index];
        if (element)
          element.style.transform = `translate(${state.offset.x}px, ${state.offset.y}px)`;
      });
    }

    const initialPanel = panelRef.current;
    if (initialPanel) {
      spawnOrbs(SHOWCASE_ORBS, states, initialPanel.getBoundingClientRect(), Math.random);
      render();
    }

    // Reveal now that the orbs are positioned — this is what prevents the first-paint flash.
    setHasStarted(true);

    // Under reduced motion the orbs stay at their random spawn — no drift loop.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = requestAnimationFrame(function step() {
      const panel = panelRef.current;
      if (panel) {
        stepOrbPhysics(
          SHOWCASE_ORBS,
          states,
          panel.getBoundingClientRect(),
          cursorRef.current,
          Math.random
        );
        render();
      }
      frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return { panelRef, orbElementsRef, hasStarted, handlePanelMouseMove, handlePanelMouseLeave };
}
