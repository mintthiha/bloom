import { api, CategoryType } from "@/lib/api";
import { CATEGORY_COLOR_OPTIONS } from "@/lib/category-options";

/**
 * Persists a free-typed "Custom..." category name as a real Category (with a
 * random colour) so it shows up in the Categories page and future pickers.
 * Silently no-ops if the name already exists; other failures are swallowed
 * since this is a best-effort side effect and must never block the caller's
 * primary action (e.g. recording a transaction).
 */
export async function ensureCustomCategoryExists(name: string, type: CategoryType): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const randomColor =
    CATEGORY_COLOR_OPTIONS[Math.floor(Math.random() * CATEGORY_COLOR_OPTIONS.length)]!.value;
  try {
    await api.createCategory({ name: trimmedName, type, color: randomColor, icon: null });
  } catch {
    // Duplicate names (409) are expected and fine; other errors are non-fatal here.
  }
}
