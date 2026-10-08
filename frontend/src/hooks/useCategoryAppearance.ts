import { useMemo } from "react";
import { useCategories } from "@/hooks/useCategories";
import { buildCategoryAppearanceLookup } from "@/lib/category-appearance";

/**
 * Exposes the user's category colours as a name-keyed lookup for `CategoryChip`, so each
 * consumer gets the index without rebuilding it on every render.
 */
export function useCategoryAppearance() {
  const { categories, isLoading } = useCategories();

  const categoryAppearanceLookup = useMemo(
    () => buildCategoryAppearanceLookup(categories),
    [categories]
  );

  return { categoryAppearanceLookup, isLoading };
}
