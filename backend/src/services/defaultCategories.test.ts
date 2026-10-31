import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "./defaultCategories";

// These rows are inserted for every new user, and Category has @@unique([userId, name]), so a
// duplicate name would make seeding fail for everyone. Existing transactions, budgets, and rules
// also reference these names as plain strings, so the fallbacks must keep their exact spelling.

describe("DEFAULT_CATEGORIES", () => {
  it("never repeats a name, which would break per-user seeding", () => {
    const names = DEFAULT_CATEGORIES.map((category) => category.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("offers both expense and income categories", () => {
    const types = new Set(DEFAULT_CATEGORIES.map((category) => category.type));
    expect(types).toEqual(new Set(["EXPENSE", "INCOME"]));
  });

  it("includes a catch-all for each type", () => {
    expect(DEFAULT_CATEGORIES).toContainEqual(
      expect.objectContaining({ name: "Other", type: "EXPENSE" })
    );
    expect(DEFAULT_CATEGORIES).toContainEqual(
      expect.objectContaining({ name: "Other Income", type: "INCOME" })
    );
  });

  it("gives every category a #rrggbb colour and a non-empty icon", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.color, category.name).toMatch(/^#[0-9a-f]{6}$/i);
      expect(category.icon.trim(), category.name).not.toBe("");
    }
  });

  it("keeps names trimmed so string matches against existing records still work", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.name).toBe(category.name.trim());
    }
  });
});
