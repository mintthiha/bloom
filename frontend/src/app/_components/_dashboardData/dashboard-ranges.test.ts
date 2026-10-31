import { describe, expect, it } from "vitest";
import { buildPreviousRangeQuery, getDashboardColumns, getTwoColumnGrid } from "./dashboard-ranges";

describe("buildPreviousRangeQuery", () => {
  it("returns the equally long period ending where the range starts", () => {
    expect(
      buildPreviousRangeQuery({
        start: "2026-03-01T00:00:00.000Z",
        end: "2026-03-31T00:00:00.000Z",
      })
    ).toEqual({
      start: "2026-01-30T00:00:00.000Z",
      end: "2026-03-01T00:00:00.000Z",
    });
  });

  it("returns undefined for an all-time view with no range", () => {
    expect(buildPreviousRangeQuery(undefined)).toBeUndefined();
  });

  it("returns undefined when either bound is missing or unparseable", () => {
    expect(buildPreviousRangeQuery({ start: "2026-03-01T00:00:00.000Z" })).toBeUndefined();
    expect(buildPreviousRangeQuery({ start: "soon", end: "later" })).toBeUndefined();
  });
});

describe("getDashboardColumns", () => {
  it("maps each dashboard view to its grid columns", () => {
    expect(getDashboardColumns("single")).toBe("1fr");
    expect(getDashboardColumns("double")).toBe("repeat(2, minmax(0, 1fr))");
    expect(getDashboardColumns("triple")).toBe("repeat(auto-fit, minmax(340px, 1fr))");
  });
});

describe("getTwoColumnGrid", () => {
  it("collapses to one column in the single view only", () => {
    expect(getTwoColumnGrid("single")).toBe("1fr");
    expect(getTwoColumnGrid("double")).toBe("repeat(auto-fit, minmax(480px, 1fr))");
  });
});
