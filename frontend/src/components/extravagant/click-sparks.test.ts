import { describe, expect, it } from "vitest";
import {
  createSparkBurst,
  sparkOpacity,
  SPARK_PALETTE_SIZE,
  SPARKS_PER_BURST,
  stepSparks,
  type Spark,
} from "./click-sparks";

/** A spark with easy round numbers for stepping assertions. */
function buildSpark(overrides: Partial<Spark> = {}): Spark {
  return {
    x: 100,
    y: 100,
    velocityX: 0.2,
    velocityY: 0,
    radius: 2,
    ageMs: 0,
    lifetimeMs: 500,
    colorIndex: 0,
    ...overrides,
  };
}

describe("createSparkBurst", () => {
  it("creates the default number of sparks at the origin", () => {
    const sparks = createSparkBurst(40, 60, () => 0.5);
    expect(sparks).toHaveLength(SPARKS_PER_BURST);
    for (const spark of sparks) {
      expect(spark.x).toBe(40);
      expect(spark.y).toBe(60);
      expect(spark.ageMs).toBe(0);
    }
  });

  it("honours a custom spark count", () => {
    expect(createSparkBurst(0, 0, () => 0.5, 5)).toHaveLength(5);
  });

  it("spreads sparks around the full circle rather than one side", () => {
    const sparks = createSparkBurst(0, 0, () => 0.5, 8);
    expect(sparks.some((spark) => spark.velocityX > 0)).toBe(true);
    expect(sparks.some((spark) => spark.velocityX < 0)).toBe(true);
    expect(sparks.some((spark) => spark.velocityY > 0)).toBe(true);
    expect(sparks.some((spark) => spark.velocityY < 0)).toBe(true);
  });

  it("cycles colour indices through the palette", () => {
    const sparks = createSparkBurst(0, 0, () => 0.5, SPARK_PALETTE_SIZE * 2);
    expect(sparks.map((spark) => spark.colorIndex)).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it("keeps speed, radius, and lifetime inside their bounds at both random extremes", () => {
    for (const sample of [0, 0.999999]) {
      for (const spark of createSparkBurst(0, 0, () => sample)) {
        const speed = Math.hypot(spark.velocityX, spark.velocityY);
        expect(speed).toBeGreaterThanOrEqual(0.12 - 1e-9);
        expect(speed).toBeLessThanOrEqual(0.42 + 1e-9);
        expect(spark.radius).toBeGreaterThanOrEqual(1.5);
        expect(spark.radius).toBeLessThanOrEqual(3.5);
        expect(spark.lifetimeMs).toBeGreaterThanOrEqual(420);
        expect(spark.lifetimeMs).toBeLessThanOrEqual(820);
      }
    }
  });
});

describe("stepSparks", () => {
  it("moves a spark along its velocity and ages it", () => {
    const [stepped] = stepSparks([buildSpark()], 100);
    expect(stepped.ageMs).toBe(100);
    expect(stepped.x).toBeGreaterThan(100);
    // Drag means it travels a little less than velocity × time.
    expect(stepped.x).toBeLessThan(120);
  });

  it("pulls sparks downward over time", () => {
    const [stepped] = stepSparks([buildSpark({ velocityY: 0 })], 100);
    expect(stepped.velocityY).toBeGreaterThan(0);
    expect(stepped.y).toBeGreaterThan(100);
  });

  it("removes a spark exactly when it reaches its lifetime", () => {
    expect(stepSparks([buildSpark({ ageMs: 400, lifetimeMs: 500 })], 100)).toEqual([]);
  });

  it("keeps a spark that is just short of its lifetime", () => {
    expect(stepSparks([buildSpark({ ageMs: 400, lifetimeMs: 500 })], 99)).toHaveLength(1);
  });

  it("does not mutate the input sparks", () => {
    const original = buildSpark();
    stepSparks([original], 50);
    expect(original.x).toBe(100);
    expect(original.ageMs).toBe(0);
  });

  it("returns the sparks untouched for a zero or negative step", () => {
    const sparks = [buildSpark()];
    expect(stepSparks(sparks, 0)).toBe(sparks);
    expect(stepSparks(sparks, -16)).toBe(sparks);
  });
});

describe("sparkOpacity", () => {
  it("is fully opaque at birth", () => {
    expect(sparkOpacity(buildSpark({ ageMs: 0 }))).toBe(1);
  });

  it("fades as the spark ages", () => {
    expect(sparkOpacity(buildSpark({ ageMs: 250, lifetimeMs: 500 }))).toBeCloseTo(0.25);
  });

  it("is zero at and beyond end of life", () => {
    expect(sparkOpacity(buildSpark({ ageMs: 500, lifetimeMs: 500 }))).toBe(0);
    expect(sparkOpacity(buildSpark({ ageMs: 900, lifetimeMs: 500 }))).toBe(0);
  });
});
