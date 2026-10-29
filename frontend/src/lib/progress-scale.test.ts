import { describe, expect, it } from "vitest";
import { toProgressScale } from "./progress-scale";

describe("toProgressScale", () => {
  it("converts a percentage to a 0–1 scale", () => {
    expect(toProgressScale(0)).toBe(0);
    expect(toProgressScale(42)).toBe(0.42);
    expect(toProgressScale(100)).toBe(1);
  });

  it("caps an over-limit value at a full bar", () => {
    expect(toProgressScale(135)).toBe(1);
  });

  it("floors a negative value at an empty bar instead of mirroring it", () => {
    expect(toProgressScale(-20)).toBe(0);
  });

  it("draws an empty bar for non-finite input", () => {
    expect(toProgressScale(Number.NaN)).toBe(0);
    expect(toProgressScale(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
