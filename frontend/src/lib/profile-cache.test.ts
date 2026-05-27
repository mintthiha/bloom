import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedFirstName, getGreeting, setCachedFirstName } from "./profile-cache";

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// getCachedFirstName
// ---------------------------------------------------------------------------

describe("getCachedFirstName", () => {
  it("returns null when nothing has been cached", () => {
    expect(getCachedFirstName()).toBeNull();
  });

  it("returns the stored first name when one exists", () => {
    localStorage.setItem("bloom_profile_first_name", "Alice");

    expect(getCachedFirstName()).toBe("Alice");
  });

  it("returns null when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("storage unavailable");
    });

    expect(getCachedFirstName()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setCachedFirstName
// ---------------------------------------------------------------------------

describe("setCachedFirstName", () => {
  it("writes the first name so that getCachedFirstName can read it back", () => {
    setCachedFirstName("Bob");

    expect(localStorage.getItem("bloom_profile_first_name")).toBe("Bob");
  });

  it("does not throw when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("storage unavailable");
    });

    expect(() => setCachedFirstName("Bob")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getGreeting
// ---------------------------------------------------------------------------

describe("getGreeting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Good morning' at 05:00 (lower boundary)", () => {
    vi.setSystemTime(new Date(2026, 4, 15, 5, 0, 0));
    expect(getGreeting()).toBe("Good morning");
  });

  it("returns 'Good morning' at 11:59", () => {
    vi.setSystemTime(new Date(2026, 4, 15, 11, 59, 0));
    expect(getGreeting()).toBe("Good morning");
  });

  it("returns 'Good afternoon' at 12:00 (lower boundary)", () => {
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
    expect(getGreeting()).toBe("Good afternoon");
  });

  it("returns 'Good afternoon' at 16:59", () => {
    vi.setSystemTime(new Date(2026, 4, 15, 16, 59, 0));
    expect(getGreeting()).toBe("Good afternoon");
  });

  it("returns 'Good evening' at 17:00 (lower boundary)", () => {
    vi.setSystemTime(new Date(2026, 4, 15, 17, 0, 0));
    expect(getGreeting()).toBe("Good evening");
  });

  it("returns 'Good evening' at midnight (00:00)", () => {
    vi.setSystemTime(new Date(2026, 4, 15, 0, 0, 0));
    expect(getGreeting()).toBe("Good evening");
  });

  it("returns 'Good evening' at 04:59 (just before morning boundary)", () => {
    vi.setSystemTime(new Date(2026, 4, 15, 4, 59, 0));
    expect(getGreeting()).toBe("Good evening");
  });
});
