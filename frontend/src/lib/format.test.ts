import { describe, expect, it } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formats a positive amount as CAD with cents by default", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats zero with cents by default", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats a negative amount with cents by default", () => {
    expect(formatCurrency(-42.5)).toBe("-$42.50");
  });

  it("rounds off the cents when hideCents is true", () => {
    expect(formatCurrency(1234.56, { hideCents: true })).toBe("$1,235");
  });

  it("rounds down when hideCents is true and cents are below the midpoint", () => {
    expect(formatCurrency(1234.4, { hideCents: true })).toBe("$1,234");
  });

  it("keeps cents when hideCents is explicitly false", () => {
    expect(formatCurrency(1234.56, { hideCents: false })).toBe("$1,234.56");
  });
});
