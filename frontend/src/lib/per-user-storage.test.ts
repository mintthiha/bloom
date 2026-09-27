import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_USER_STORAGE_KEY,
  PER_USER_STORAGE_KEYS,
  clearPerUserStorage,
} from "./per-user-storage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("clearPerUserStorage", () => {
  it("removes every per-user preference and the active-user marker", () => {
    for (const key of PER_USER_STORAGE_KEYS) {
      localStorage.setItem(key, "stale");
    }
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, "u-1");

    clearPerUserStorage();

    for (const key of PER_USER_STORAGE_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(localStorage.getItem(ACTIVE_USER_STORAGE_KEY)).toBeNull();
  });

  it("leaves appearance preferences alone so theme survives a delete", () => {
    localStorage.setItem("bloom-theme", "light");

    clearPerUserStorage();

    expect(localStorage.getItem("bloom-theme")).toBe("light");
  });

  it("does not throw when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => clearPerUserStorage()).not.toThrow();
  });

  it("includes the saved sign-in token so a deleted account cannot be offered again", () => {
    expect(PER_USER_STORAGE_KEYS).toContain("bloom_saved_account");
  });
});
