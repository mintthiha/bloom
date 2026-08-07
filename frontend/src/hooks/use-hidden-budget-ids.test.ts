import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHiddenBudgetIds } from "./use-hidden-budget-ids";

const STORAGE_KEY = "bloom.budgets.hiddenIds";

afterEach(() => {
  localStorage.clear();
});

describe("useHiddenBudgetIds", () => {
  it("starts empty when nothing is persisted", () => {
    const { result } = renderHook(() => useHiddenBudgetIds());
    expect(result.current.hiddenBudgetIds).toEqual(new Set());
  });

  it("loads the persisted set on mount", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["b-1", "b-2"]));
    const { result } = renderHook(() => useHiddenBudgetIds());
    expect(result.current.hiddenBudgetIds).toEqual(new Set(["b-1", "b-2"]));
  });

  it("ignores non-string entries in the persisted array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["b-1", 42, null]));
    const { result } = renderHook(() => useHiddenBudgetIds());
    expect(result.current.hiddenBudgetIds).toEqual(new Set(["b-1"]));
  });

  it("falls back to empty on malformed storage", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    const { result } = renderHook(() => useHiddenBudgetIds());
    expect(result.current.hiddenBudgetIds).toEqual(new Set());
  });

  it("adds a budget id on first toggle and persists it", () => {
    const { result } = renderHook(() => useHiddenBudgetIds());
    act(() => result.current.toggleBudgetVisibility("b-1"));
    expect(result.current.hiddenBudgetIds).toEqual(new Set(["b-1"]));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(["b-1"]);
  });

  it("removes a budget id on a second toggle", () => {
    const { result } = renderHook(() => useHiddenBudgetIds());
    act(() => result.current.toggleBudgetVisibility("b-1"));
    act(() => result.current.toggleBudgetVisibility("b-1"));
    expect(result.current.hiddenBudgetIds).toEqual(new Set());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });
});
