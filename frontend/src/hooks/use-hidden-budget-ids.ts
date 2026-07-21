"use client";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bloom.budgets.hiddenIds";

/**
 * localStorage-backed set of budget ids the user has hidden from the dashboard Budgets card.
 * An empty set means "show all". Starts empty on the server/initial render to avoid a hydration
 * mismatch, loads the persisted set once on mount, and writes back on every toggle.
 */
export function useHiddenBudgetIds(): {
  hiddenBudgetIds: Set<string>;
  toggleBudgetVisibility: (id: string) => void;
} {
  const [hiddenBudgetIds, setHiddenBudgetIds] = useState<Set<string>>(new Set());

  /** Loads the persisted hidden ids once on mount (client only). */
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setHiddenBudgetIds(new Set(parsed.filter((value) => typeof value === "string")));
      }
    } catch {
      // Ignore malformed storage and fall back to showing all budgets.
    }
  }, []);

  /** Toggles a budget's visibility and persists the updated set. */
  const toggleBudgetVisibility = useCallback((id: string) => {
    setHiddenBudgetIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { hiddenBudgetIds, toggleBudgetVisibility };
}
