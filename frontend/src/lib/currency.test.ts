import { describe, expect, it } from "vitest";
import { getCurrencyLocale, getRateForCurrency, parseCurrency } from "./currency";

describe("parseCurrency", () => {
  it("returns the matching currency for a valid code", () => {
    expect(parseCurrency("USD")).toBe("USD");
  });

  it("is case-insensitive", () => {
    expect(parseCurrency("eur")).toBe("EUR");
  });

  it("trims surrounding whitespace", () => {
    expect(parseCurrency("  CAD  ")).toBe("CAD");
  });

  it("returns null for an unrecognized code", () => {
    expect(parseCurrency("GBP")).toBeNull();
  });

  it("returns null for null, undefined, or empty input", () => {
    expect(parseCurrency(null)).toBeNull();
    expect(parseCurrency(undefined)).toBeNull();
    expect(parseCurrency("")).toBeNull();
  });
});

describe("getCurrencyLocale", () => {
  it("resolves the locale for each supported currency", () => {
    expect(getCurrencyLocale("CAD")).toBe("en-CA");
    expect(getCurrencyLocale("USD")).toBe("en-US");
    expect(getCurrencyLocale("EUR")).toBe("en-IE");
  });
});

describe("getRateForCurrency", () => {
  const rates = { cadToUsd: 0.73, cadToEur: 0.68 };

  it("returns 1 for CAD regardless of the cached rates", () => {
    expect(getRateForCurrency("CAD", rates)).toBe(1);
  });

  it("returns the CAD-to-USD rate for USD", () => {
    expect(getRateForCurrency("USD", rates)).toBe(0.73);
  });

  it("returns the CAD-to-EUR rate for EUR", () => {
    expect(getRateForCurrency("EUR", rates)).toBe(0.68);
  });
});
