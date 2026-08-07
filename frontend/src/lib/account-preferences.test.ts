import { afterEach, describe, expect, it } from "vitest";
import {
  readHiddenAccountIds,
  readPinnedAccountIds,
  writeHiddenAccountIds,
  writePinnedAccountIds,
} from "./account-preferences";

const PINNED_KEY = "bloom-pinned-accounts";

afterEach(() => {
  localStorage.clear();
});

describe("account-preferences", () => {
  it("returns an empty array when nothing is pinned", () => {
    expect(readPinnedAccountIds()).toEqual([]);
  });

  it("round-trips pinned account ids", () => {
    writePinnedAccountIds(["acct-1", "acct-2"]);
    expect(readPinnedAccountIds()).toEqual(["acct-1", "acct-2"]);
  });

  it("round-trips hidden account ids independently of pinned", () => {
    writePinnedAccountIds(["acct-1"]);
    writeHiddenAccountIds(["acct-9"]);
    expect(readPinnedAccountIds()).toEqual(["acct-1"]);
    expect(readHiddenAccountIds()).toEqual(["acct-9"]);
  });

  it("returns an empty array for malformed JSON", () => {
    localStorage.setItem(PINNED_KEY, "not json");
    expect(readPinnedAccountIds()).toEqual([]);
  });

  it("returns an empty array when the stored value is not an array", () => {
    localStorage.setItem(PINNED_KEY, JSON.stringify({ acct: 1 }));
    expect(readPinnedAccountIds()).toEqual([]);
  });
});
