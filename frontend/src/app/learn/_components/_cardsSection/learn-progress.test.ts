import { afterEach, describe, expect, it } from "vitest";
import { getExploredCardIndices, markCardExplored } from "./learn-progress";

const STORAGE_KEY = "bloom_learn_explored";

afterEach(() => {
  localStorage.clear();
});

describe("learn-progress", () => {
  it("returns an empty set when nothing is stored", () => {
    expect(getExploredCardIndices()).toEqual(new Set());
  });

  it("records an explored card index", () => {
    markCardExplored(2);
    expect(getExploredCardIndices()).toEqual(new Set([2]));
  });

  it("merges newly explored indices without duplicating", () => {
    markCardExplored(0);
    markCardExplored(1);
    markCardExplored(0);
    expect(getExploredCardIndices()).toEqual(new Set([0, 1]));
  });

  it("returns an empty set for malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    expect(getExploredCardIndices()).toEqual(new Set());
  });

  it("returns an empty set when the stored value is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index: 1 }));
    expect(getExploredCardIndices()).toEqual(new Set());
  });
});
