import { describe, expect, it } from "vitest";
import { getCurrencyLocale, parseCurrency } from "./currency";

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
