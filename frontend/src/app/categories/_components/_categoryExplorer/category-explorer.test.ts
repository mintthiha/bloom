import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/api";
import { filterAndSortCategories, paginate } from "./category-explorer";

/** Builds a Category fixture. */
function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    userId: "u-1",
    name: "Groceries",
    type: "EXPENSE",
    color: "#22c55e",
    icon: "🛒",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterAndSortCategories", () => {
  const categories = [
    makeCategory({
      id: "1",
      name: "Groceries",
      type: "EXPENSE",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    makeCategory({
      id: "2",
      name: "Salary",
      type: "INCOME",
      createdAt: "2026-02-01T00:00:00.000Z",
    }),
    makeCategory({
      id: "3",
      name: "Utilities",
      type: "EXPENSE",
      createdAt: "2026-03-01T00:00:00.000Z",
    }),
  ];

  it("keeps only categories of the active types", () => {
    const result = filterAndSortCategories(categories, {
      search: "",
      activeTypes: ["INCOME"],
      sort: "name_asc",
    });
    expect(result.map((category) => category.id)).toEqual(["2"]);
  });

  it("returns nothing when no types are active", () => {
    const result = filterAndSortCategories(categories, {
      search: "",
      activeTypes: [],
      sort: "name_asc",
    });
    expect(result).toEqual([]);
  });

  it("matches search case-insensitively against the name", () => {
    const result = filterAndSortCategories(categories, {
      search: "util",
      activeTypes: ["EXPENSE", "INCOME"],
      sort: "name_asc",
    });
    expect(result.map((category) => category.id)).toEqual(["3"]);
  });

  it("sorts by name ascending and descending", () => {
    const asc = filterAndSortCategories(categories, {
      search: "",
      activeTypes: ["EXPENSE", "INCOME"],
      sort: "name_asc",
    });
    expect(asc.map((category) => category.name)).toEqual(["Groceries", "Salary", "Utilities"]);

    const desc = filterAndSortCategories(categories, {
      search: "",
      activeTypes: ["EXPENSE", "INCOME"],
      sort: "name_desc",
    });
    expect(desc.map((category) => category.name)).toEqual(["Utilities", "Salary", "Groceries"]);
  });

  it("sorts by creation date newest and oldest first", () => {
    const newest = filterAndSortCategories(categories, {
      search: "",
      activeTypes: ["EXPENSE", "INCOME"],
      sort: "newest",
    });
    expect(newest.map((category) => category.id)).toEqual(["3", "2", "1"]);

    const oldest = filterAndSortCategories(categories, {
      search: "",
      activeTypes: ["EXPENSE", "INCOME"],
      sort: "oldest",
    });
    expect(oldest.map((category) => category.id)).toEqual(["1", "2", "3"]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 10 }, (_, index) => index);

  it("slices the first page", () => {
    expect(paginate(items, 1, 4)).toEqual([0, 1, 2, 3]);
  });

  it("slices a middle page", () => {
    expect(paginate(items, 2, 4)).toEqual([4, 5, 6, 7]);
  });

  it("returns a partial final page", () => {
    expect(paginate(items, 3, 4)).toEqual([8, 9]);
  });

  it("returns an empty array past the last page", () => {
    expect(paginate(items, 4, 4)).toEqual([]);
  });
});
