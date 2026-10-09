import { describe, expect, it } from "vitest";
import { UserDataExport } from "@/lib/api";
import {
  buildUserDataExportFilename,
  buildUserDataJson,
  describeUserDataExport,
  summarizeUserDataExport,
} from "./export-user-data";

/** Builds an otherwise-empty export bundle with only the given sections populated. */
function makeExport(overrides: Partial<UserDataExport> = {}): UserDataExport {
  return {
    exportVersion: 1,
    exportedAt: "2026-09-26T12:00:00.000Z",
    profile: null,
    accounts: [],
    transactions: [],
    budgets: [],
    savingsGoals: [],
    recurringTransactions: [],
    manualEntries: [],
    categorizationRules: [],
    customCategories: [],
    netWorthSnapshots: [],
    chatMessages: [],
    ...overrides,
  };
}

describe("buildUserDataJson", () => {
  it("produces indented JSON that round-trips back to the same bundle", () => {
    const data = makeExport({ accounts: [{ id: "a-1" }] as UserDataExport["accounts"] });

    const json = buildUserDataJson(data);

    expect(json).toContain("\n  ");
    expect(JSON.parse(json)).toEqual(data);
  });
});

describe("buildUserDataExportFilename", () => {
  it("dates the filename from the given day", () => {
    expect(buildUserDataExportFilename("json", new Date("2026-09-26T23:30:00.000Z"))).toBe(
      "bloom-my-data-2026-09-26.json"
    );
  });

  it("defaults to today when no date is given", () => {
    expect(buildUserDataExportFilename("json")).toMatch(/^bloom-my-data-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe("summarizeUserDataExport", () => {
  it("omits sections that hold nothing", () => {
    const rows = summarizeUserDataExport(
      makeExport({
        accounts: [{ id: "a-1" }, { id: "a-2" }] as UserDataExport["accounts"],
        transactions: [{ id: "t-1" }] as UserDataExport["transactions"],
      })
    );

    expect(rows).toEqual([
      { label: "accounts", count: 2 },
      { label: "transaction", count: 1 },
    ]);
  });

  it("includes custom categories when present", () => {
    const rows = summarizeUserDataExport(
      makeExport({
        customCategories: [
          {
            name: "Groceries",
            type: "EXPENSE",
            color: "#22c55e",
            icon: "🛒",
            createdAt: "2026-01-01",
          },
        ] as UserDataExport["customCategories"],
      })
    );

    expect(rows).toEqual([{ label: "custom category", count: 1 }]);
  });

  it("counts the Bloom AI conversation when present", () => {
    const rows = summarizeUserDataExport(
      makeExport({
        chatMessages: [
          { role: "user", content: "What is a TFSA?", createdAt: "2026-10-08T12:00:00.000Z" },
          { role: "assistant", content: "An account.", createdAt: "2026-10-08T12:00:05.000Z" },
        ],
      })
    );

    expect(rows).toEqual([{ label: "Bloom AI messages", count: 2 }]);
  });

  it("returns nothing at all for a completely empty account", () => {
    expect(summarizeUserDataExport(makeExport())).toEqual([]);
  });
});

describe("describeUserDataExport", () => {
  it("joins the populated sections into one sentence", () => {
    const description = describeUserDataExport(
      makeExport({
        accounts: [{ id: "a-1" }] as UserDataExport["accounts"],
        budgets: [{ category: "Groceries" }, { category: "Rent" }] as UserDataExport["budgets"],
      })
    );

    expect(description).toBe("1 account · 2 budgets");
  });

  it("explains that there is nothing to export yet when every section is empty", () => {
    expect(describeUserDataExport(makeExport())).toBe("Your account has no data yet");
  });
});
