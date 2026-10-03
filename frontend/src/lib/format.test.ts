import { afterEach, describe, expect, it } from "vitest";
import { formatCurrency, setActiveCurrency } from "./format";

describe("formatCurrency", () => {
  afterEach(() => {
    setActiveCurrency("CAD");
  });

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

  it("uses the active currency's symbol/locale set by setActiveCurrency", () => {
    setActiveCurrency("EUR", 0.68);
    expect(formatCurrency(1234.56).startsWith("€")).toBe(true);
  });

  it("converts the amount using the active currency's CAD conversion rate", () => {
    setActiveCurrency("EUR", 0.5);
    expect(formatCurrency(1000)).toBe("€500.00");
  });

  it("applies no conversion (rate 1) when switching back to CAD", () => {
    setActiveCurrency("EUR", 0.5);
    setActiveCurrency("CAD");
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("rounds the converted amount's cents when hideCents is true", () => {
    setActiveCurrency("EUR", 0.5);
    expect(formatCurrency(1000.6, { hideCents: true })).toBe("€500");
  });
});
