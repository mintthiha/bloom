import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTRY_TYPE_LABELS, formatDate, todayString } from "./manual-entry-format";

afterEach(() => {
  vi.useRealTimers();
});

describe("ENTRY_TYPE_LABELS", () => {
  it("names both entry types", () => {
    expect(ENTRY_TYPE_LABELS).toEqual({ ASSET: "Asset", LIABILITY: "Liability" });
  });
});

describe("todayString", () => {
  it("returns the local date as YYYY-MM-DD with zero padding", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 7, 23, 30));

    expect(todayString()).toBe("2026-03-07");
  });
});

describe("formatDate", () => {
  it("formats a YYYY-MM-DD date for display without shifting the day", () => {
    expect(formatDate("2026-09-08")).toBe(
      new Date(2026, 8, 8).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    );
  });

  it("shows a dash when there is no date", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
  });
});
