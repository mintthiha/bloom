/** One glowing particle thrown out by a click. Positions are viewport pixels. */
export type Spark = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  ageMs: number;
  lifetimeMs: number;
  /** Index into the palette the canvas paints with, so a burst mixes the accent's companions. */
  colorIndex: number;
};

export const SPARKS_PER_BURST = 16;
export const SPARK_PALETTE_SIZE = 3;

const MIN_SPEED = 0.12; // px per ms
const MAX_SPEED = 0.42; // px per ms
const MIN_LIFETIME_MS = 420;
const MAX_LIFETIME_MS = 820;
const MIN_RADIUS = 1.5;
const MAX_RADIUS = 3.5;
const GRAVITY = 0.0006; // px per ms², pulls sparks into a soft arc
const DRAG_PER_MS = 0.9975; // velocity retained per millisecond

/** Linearly maps a 0–1 random sample into [minimum, maximum]. */
function scaleSample(sample: number, minimum: number, maximum: number): number {
  return minimum + sample * (maximum - minimum);
}

/**
 * Creates one burst of sparks radiating from a point. Angles are spread evenly around the circle
 * (with a little jitter) so a burst always reads as a full ring rather than a lopsided clump.
 * `random` is injectable so the spread is deterministic under test.
 */
export function createSparkBurst(
  originX: number,
  originY: number,
  random: () => number = Math.random,
  sparkCount: number = SPARKS_PER_BURST
): Spark[] {
  const sparks: Spark[] = [];
  for (let sparkIndex = 0; sparkIndex < sparkCount; sparkIndex++) {
    const angle = ((sparkIndex + random() * 0.6) / sparkCount) * Math.PI * 2;
    const speed = scaleSample(random(), MIN_SPEED, MAX_SPEED);
    sparks.push({
      x: originX,
      y: originY,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      radius: scaleSample(random(), MIN_RADIUS, MAX_RADIUS),
      ageMs: 0,
      lifetimeMs: scaleSample(random(), MIN_LIFETIME_MS, MAX_LIFETIME_MS),
      colorIndex: sparkIndex % SPARK_PALETTE_SIZE,
    });
  }
  return sparks;
}

/**
 * Advances every spark by `elapsedMs` (drag, gravity, then movement) and drops the ones that have
 * outlived their lifetime. Returns a new array; the input is not mutated.
 */
export function stepSparks(sparks: Spark[], elapsedMs: number): Spark[] {
  if (elapsedMs <= 0) return sparks;
  const drag = Math.pow(DRAG_PER_MS, elapsedMs);
  const survivors: Spark[] = [];
  for (const spark of sparks) {
    const ageMs = spark.ageMs + elapsedMs;
    if (ageMs >= spark.lifetimeMs) continue;
    const velocityX = spark.velocityX * drag;
    const velocityY = spark.velocityY * drag + GRAVITY * elapsedMs;
    survivors.push({
      ...spark,
      ageMs,
      velocityX,
      velocityY,
      x: spark.x + velocityX * elapsedMs,
      y: spark.y + velocityY * elapsedMs,
    });
  }
  return survivors;
}

/** Opacity for a spark at its current age: full at birth, easing out to nothing at end of life. */
export function sparkOpacity(spark: Spark): number {
  const remaining = 1 - spark.ageMs / spark.lifetimeMs;
  if (remaining <= 0) return 0;
  return Math.min(1, remaining * remaining);
}
