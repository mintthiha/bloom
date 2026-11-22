"use client";

import { useEffect, useRef } from "react";
import { createSparkBurst, sparkOpacity, stepSparks, type Spark } from "./click-sparks";

/** CSS variables the sparks are painted with, in `colorIndex` order. */
const SPARK_COLOR_VARIABLES = ["--brand-accent", "--extravagant-hue-b", "--extravagant-hue-c"];
const FALLBACK_SPARK_COLOR = "#f59e0b";

/** Resolves the spark palette from the live theme so bursts follow the user's accent colour. */
function readSparkPalette(): string[] {
  const rootStyle = getComputedStyle(document.documentElement);
  return SPARK_COLOR_VARIABLES.map(
    (variableName) => rootStyle.getPropertyValue(variableName).trim() || FALLBACK_SPARK_COLOR
  );
}

/**
 * Full-viewport canvas that throws a ring of glowing sparks from every click or tap. Purely
 * decorative: it ignores pointer events, and its animation loop only runs while sparks are alive.
 */
export function ClickSparks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Wires the pointer listener and the on-demand paint loop to the canvas. */
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let sparks: Spark[] = [];
    let palette = readSparkPalette();
    let frameId = 0;
    let previousTimestamp = 0;
    let isLoopRunning = false;

    /** Matches the canvas backing store to the viewport at the device's pixel density. */
    function resizeCanvas() {
      if (!canvas || !context) return;
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * pixelRatio;
      canvas.height = window.innerHeight * pixelRatio;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    /** Advances and paints the sparks, stopping the loop once the last one has faded. */
    function paintFrame(timestamp: number) {
      if (!context) return;
      const elapsedMs = Math.min(48, timestamp - previousTimestamp);
      previousTimestamp = timestamp;
      sparks = stepSparks(sparks, elapsedMs);

      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const spark of sparks) {
        const color = palette[spark.colorIndex] ?? FALLBACK_SPARK_COLOR;
        context.globalAlpha = sparkOpacity(spark);
        context.fillStyle = color;
        context.shadowColor = color;
        context.shadowBlur = 12;
        context.beginPath();
        context.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      if (sparks.length === 0) {
        isLoopRunning = false;
        return;
      }
      frameId = requestAnimationFrame(paintFrame);
    }

    /** Adds a burst at the pointer and starts the paint loop if it is idle. */
    function handlePointerDown(event: PointerEvent) {
      palette = readSparkPalette();
      sparks = sparks.concat(createSparkBurst(event.clientX, event.clientY));
      if (isLoopRunning) return;
      isLoopRunning = true;
      previousTimestamp = performance.now();
      frameId = requestAnimationFrame(paintFrame);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="extravagant-sparks-canvas" />;
}
