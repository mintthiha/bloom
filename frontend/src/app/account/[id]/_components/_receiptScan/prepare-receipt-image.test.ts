import { describe, expect, it } from "vitest";
import { calculateReceiptImageScale } from "./prepare-receipt-image";

describe("calculateReceiptImageScale", () => {
  it("leaves an image within both limits untouched", () => {
    expect(calculateReceiptImageScale(1200, 3000)).toBe(1);
  });

  it("leaves an image exactly at both limits untouched", () => {
    expect(calculateReceiptImageScale(1500, 4000)).toBe(1);
  });

  it("shrinks a typical phone photo by its short edge", () => {
    expect(calculateReceiptImageScale(3000, 4000)).toBe(0.5);
  });

  it("applies the same limits to a landscape photo", () => {
    expect(calculateReceiptImageScale(4000, 3000)).toBe(0.5);
  });

  it("shrinks a very long, narrow receipt by its long edge", () => {
    expect(calculateReceiptImageScale(1000, 8000)).toBe(0.5);
  });

  it("uses whichever limit demands the smaller scale", () => {
    // Short edge alone would allow 0.5, but the long edge needs 0.25.
    expect(calculateReceiptImageScale(3000, 16000)).toBe(0.25);
  });

  it("never enlarges a small image", () => {
    expect(calculateReceiptImageScale(300, 500)).toBe(1);
  });

  it("returns 1 for an empty image instead of dividing by zero", () => {
    expect(calculateReceiptImageScale(0, 0)).toBe(1);
  });
});
