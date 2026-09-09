import { describe, expect, it } from "vitest";
import { activityMeta, ACTIVITY_META } from "./activity-meta";

describe("activityMeta", () => {
  it("returns the configured metadata for a known activity type", () => {
    expect(activityMeta("ACCOUNT_CREATED")).toEqual(ACTIVITY_META.ACCOUNT_CREATED);
  });

  it("falls back to a generic entry that echoes the raw type for an unknown type", () => {
    expect(activityMeta("SOMETHING_NEW")).toEqual({
      label: "SOMETHING_NEW",
      color: "var(--text-secondary)",
      icon: "•",
    });
  });
});
