import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Category } from "@/lib/api";

/**
 * Loads the current user's custom category list (seeded with Bloom's starter
 * set on first fetch) and exposes it split by type for category pickers.
 * Falls back to an empty list on error so a picker never throws.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /** Fetches the latest category list from the API. */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.listCategories();
      setCategories(result);
    } catch {
      // Leaves the previous list in place (or empty on first load) if the fetch fails.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "INCOME"),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "EXPENSE"),
    [categories]
  );
  const incomeCategoryNames = useMemo(
    () => incomeCategories.map((category) => category.name),
    [incomeCategories]
  );
  const expenseCategoryNames = useMemo(
    () => expenseCategories.map((category) => category.name),
    [expenseCategories]
  );

  return {
    categories,
    incomeCategories,
    expenseCategories,
    incomeCategoryNames,
    expenseCategoryNames,
    isLoading,
    refresh,
  };
}
