import { describe, expect, it } from "vitest";
import { buildCanadianTaxFacts } from "./canadian-tax-facts";

describe("buildCanadianTaxFacts", () => {
  it("states the correct TFSA annual limit for a known year", () => {
    const facts = buildCanadianTaxFacts(new Date("2026-07-26T12:00:00Z"));
    expect(facts).toContain("TFSA annual contribution limit for 2026: $7,000.");
  });

  it("always includes the FHSA annual and lifetime limits", () => {
    const facts = buildCanadianTaxFacts(new Date("2026-07-26T12:00:00Z"));
    expect(facts).toContain("FHSA contribution limit: $8,000 per year, $40,000 lifetime.");
  });

  it("omits the TFSA line for a year with no figure on record, and instructs not to guess", () => {
    const facts = buildCanadianTaxFacts(new Date("2099-01-01T12:00:00Z"));
    expect(facts).not.toContain("TFSA annual contribution limit");
    expect(facts).toContain("not certain rather than guessing");
  });
});
