import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({ apiMock: { listCategories: vi.fn() } }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, listCategories: apiMock.listCategories } };
});

import { useCategories } from "./useCategories";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCategories", () => {
  it("loads categories and splits them by type", async () => {
    apiMock.listCategories.mockResolvedValue([
      makeCategory({ id: "c1", name: "Groceries", type: "EXPENSE" }),
      makeCategory({ id: "c2", name: "Salary", type: "INCOME" }),
    ]);

    const { result } = renderHook(() => useCategories());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.expenseCategoryNames).toEqual(["Groceries"]);
    expect(result.current.incomeCategoryNames).toEqual(["Salary"]);
  });

  it("starts with empty lists and isLoading true before the fetch resolves", () => {
    apiMock.listCategories.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCategories());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.categories).toEqual([]);
  });

  it("falls back to an empty list when the fetch fails", async () => {
    apiMock.listCategories.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useCategories());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.categories).toEqual([]);
  });

  it("refresh re-fetches and replaces the category list", async () => {
    apiMock.listCategories.mockResolvedValueOnce([makeCategory({ name: "Groceries" })]);
    const { result } = renderHook(() => useCategories());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    apiMock.listCategories.mockResolvedValueOnce([makeCategory({ name: "Hobbies" })]);
    await result.current.refresh();

    await waitFor(() => expect(result.current.expenseCategoryNames).toEqual(["Hobbies"]));
  });
});
