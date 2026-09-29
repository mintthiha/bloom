import type { Category, CategoryType } from "@/lib/api";

export type CategorySortKey = "name_asc" | "name_desc" | "newest" | "oldest";

/** Options offered in the category list's sort dropdown. */
export const CATEGORY_SORT_OPTIONS: { value: CategorySortKey; label: string }[] = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

/** Label and accent color for each category type, shared by the filter pills and row tags. */
export const CATEGORY_TYPE_META: Record<CategoryType, { label: string; color: string }> = {
  EXPENSE: { label: "Expense", color: "#f97316" },
  INCOME: { label: "Income", color: "#22c55e" },
};

export const CATEGORY_PAGE_SIZE = 8;

/** Filters categories to the active types and a case-insensitive name search, then sorts them. */
export function filterAndSortCategories(
  categories: Category[],
  options: { search: string; activeTypes: CategoryType[]; sort: CategorySortKey }
): Category[] {
  const { search, activeTypes, sort } = options;
  const query = search.trim().toLowerCase();

  const filtered = categories.filter((category) => {
    if (!activeTypes.includes(category.type)) return false;
    if (query && !category.name.toLowerCase().includes(query)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    switch (sort) {
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      default:
        return 0;
    }
  });
}

/** Slices a list to the given 1-indexed page and page size. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
