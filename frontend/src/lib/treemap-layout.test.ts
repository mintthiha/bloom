import { describe, it, expect } from "vitest";
import { computeTreemapLayout, TreemapInput } from "./treemap-layout";

/** Total area covered by a set of rectangles. */
function totalArea(rects: { width: number; height: number }[]): number {
  return rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
}

describe("computeTreemapLayout", () => {
  it("returns nothing for an empty list or a zero-size box", () => {
    expect(computeTreemapLayout([], 100, 100)).toEqual([]);
    expect(computeTreemapLayout([{ id: "a", value: 5 }], 0, 100)).toEqual([]);
  });

  it("drops non-positive values", () => {
    const result = computeTreemapLayout(
      [
        { id: "a", value: 10 },
        { id: "b", value: 0 },
        { id: "c", value: -3 },
      ],
      100,
      100
    );
    expect(result.map((rect) => rect.id)).toEqual(["a"]);
  });

  it("fills the whole box for a single item", () => {
    const [rect] = computeTreemapLayout([{ id: "solo", value: 42 }], 200, 120);
    expect(rect).toMatchObject({ id: "solo", x: 0, y: 0, width: 200, height: 120 });
  });

  it("covers the full box area without gaps across many items", () => {
    const items: TreemapInput[] = [
      { id: "a", value: 500 },
      { id: "b", value: 300 },
      { id: "c", value: 200 },
      { id: "d", value: 90 },
      { id: "e", value: 40 },
    ];
    const width = 640;
    const height = 360;
    const rects = computeTreemapLayout(items, width, height);

    expect(rects).toHaveLength(items.length);
    expect(totalArea(rects)).toBeCloseTo(width * height, 3);
    // Every tile stays inside the box.
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(-1e-6);
      expect(rect.y).toBeGreaterThanOrEqual(-1e-6);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1e-6);
      expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1e-6);
    }
  });

  it("gives larger values proportionally larger tiles", () => {
    const rects = computeTreemapLayout(
      [
        { id: "big", value: 800 },
        { id: "small", value: 200 },
      ],
      400,
      200
    );
    const big = rects.find((rect) => rect.id === "big")!;
    const small = rects.find((rect) => rect.id === "small")!;
    const bigArea = big.width * big.height;
    const smallArea = small.width * small.height;
    expect(bigArea / smallArea).toBeCloseTo(4, 1);
  });
});
