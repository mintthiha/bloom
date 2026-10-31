import { describe, expect, it } from "vitest";
import {
  ActivityFieldChange,
  describeActivityFieldChanges,
  pushActivityFieldChange,
} from "./activityChanges";

describe("pushActivityFieldChange", () => {
  it("records a field whose value changed", () => {
    const changes: ActivityFieldChange[] = [];

    pushActivityFieldChange(changes, "monthlyLimit", "Limit", "currency", 50, 75);

    expect(changes).toEqual([
      { field: "monthlyLimit", label: "Limit", kind: "currency", from: 50, to: 75 },
    ]);
  });

  it("skips a field whose value stayed the same", () => {
    const changes: ActivityFieldChange[] = [];

    pushActivityFieldChange(changes, "name", "Name", "text", "Rent", "Rent");
    pushActivityFieldChange(changes, "note", "Note", "text", null, null);

    expect(changes).toEqual([]);
  });

  it("treats null and a value as a change in either direction", () => {
    const changes: ActivityFieldChange[] = [];

    pushActivityFieldChange(changes, "targetDate", "Target date", "date", null, "2026-12-01");
    pushActivityFieldChange(changes, "note", "Note", "text", "Old note", null);

    expect(changes.map((change) => change.field)).toEqual(["targetDate", "note"]);
  });

  it("compares strictly, so a number and its string form count as different", () => {
    const changes: ActivityFieldChange[] = [];

    pushActivityFieldChange(changes, "amount", "Amount", "currency", 50, "50");

    expect(changes).toHaveLength(1);
  });

  it("appends to the existing list in call order", () => {
    const changes: ActivityFieldChange[] = [
      { field: "name", label: "Name", kind: "text", from: "A", to: "B" },
    ];

    pushActivityFieldChange(changes, "monthlyLimit", "Limit", "currency", 10, 20);

    expect(changes.map((change) => change.field)).toEqual(["name", "monthlyLimit"]);
  });
});

describe("describeActivityFieldChanges", () => {
  it("returns the fallback when nothing changed", () => {
    expect(describeActivityFieldChanges([], "Updated budget")).toBe("Updated budget");
  });

  it("formats currency values with a dollar sign and two decimals", () => {
    expect(
      describeActivityFieldChanges(
        [{ field: "monthlyLimit", label: "Limit", kind: "currency", from: 50, to: 75.5 }],
        "Updated budget"
      )
    ).toBe("Limit $50.00 → $75.50");
  });

  it("formats a numeric string currency value the same way", () => {
    expect(
      describeActivityFieldChanges(
        [{ field: "amount", label: "Amount", kind: "currency", from: "12.3", to: "4" }],
        "Updated"
      )
    ).toBe("Amount $12.30 → $4.00");
  });

  it("renders text and date values as-is", () => {
    expect(
      describeActivityFieldChanges(
        [
          { field: "name", label: "Name", kind: "text", from: "Japan", to: "Japan trip" },
          {
            field: "targetDate",
            label: "Target date",
            kind: "date",
            from: "2026-06-01",
            to: "2026-09-01",
          },
        ],
        "Updated goal"
      )
    ).toBe("Name Japan → Japan trip, Target date 2026-06-01 → 2026-09-01");
  });

  it("shows null and empty values as 'none', even for currency", () => {
    expect(
      describeActivityFieldChanges(
        [
          { field: "note", label: "Note", kind: "text", from: "", to: "Saving hard" },
          { field: "targetAmount", label: "Target", kind: "currency", from: 1000, to: null },
        ],
        "Updated goal"
      )
    ).toBe("Note none → Saving hard, Target $1000.00 → none");
  });
});
