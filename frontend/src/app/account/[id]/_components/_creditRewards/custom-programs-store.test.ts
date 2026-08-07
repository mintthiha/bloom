import { afterEach, describe, expect, it } from "vitest";
import type { CardProgram } from "./credit-rewards-math";
import {
  generateCustomProgramId,
  isCustomProgram,
  loadCustomPrograms,
  saveCustomPrograms,
} from "./custom-programs-store";

const STORAGE_KEY = "bloom-custom-reward-programs";

/** Builds a minimal custom program for persistence tests. */
function makeProgram(overrides: Partial<CardProgram> = {}): CardProgram {
  return {
    id: "custom-1",
    name: "My Card",
    description: "2x everything",
    rewardType: "points",
    baseRate: 2,
    categoryMultipliers: {},
    ...overrides,
  };
}

afterEach(() => {
  localStorage.clear();
});

describe("custom-programs-store", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(loadCustomPrograms()).toEqual([]);
  });

  it("round-trips saved programs", () => {
    const programs = [makeProgram(), makeProgram({ id: "custom-2", name: "Other" })];
    saveCustomPrograms(programs);
    expect(loadCustomPrograms()).toEqual(programs);
  });

  it("returns an empty array for malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadCustomPrograms()).toEqual([]);
  });

  it("returns an empty array when stored value is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }));
    expect(loadCustomPrograms()).toEqual([]);
  });
});

describe("generateCustomProgramId", () => {
  it("produces ids with the custom- prefix", () => {
    expect(generateCustomProgramId().startsWith("custom-")).toBe(true);
  });

  it("produces distinct ids on successive calls", () => {
    expect(generateCustomProgramId()).not.toBe(generateCustomProgramId());
  });
});

describe("isCustomProgram", () => {
  it("recognizes user-created ids", () => {
    expect(isCustomProgram("custom-123-abcde")).toBe(true);
  });

  it("rejects built-in program ids", () => {
    expect(isCustomProgram("travel")).toBe(false);
    expect(isCustomProgram("flat-cashback")).toBe(false);
  });
});
