import { Category } from "@/lib/api";
import { CATEGORY_COLOR_OPTIONS } from "@/lib/category-options";

/** The colour and glyph used to render one category name as a chip. */
export type CategoryAppearance = {
  color: string;
  icon: string | null;
  /** False when the name has no matching Category row, so the colour came from the hash fallback. */
  isKnown: boolean;
};

/** Name-keyed appearance lookup built once per render from the user's category list. */
export type CategoryAppearanceLookup = Map<string, CategoryAppearance>;

/** Colour used when a category name is missing entirely, so chips never render transparent. */
const UNCATEGORIZED_COLOR = "#64748b";

const FALLBACK_COLORS = CATEGORY_COLOR_OPTIONS.map((option) => option.value);

/** Normalizes a category name so lookups ignore casing and surrounding whitespace. */
function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Indexes the user's categories by normalized name. Transaction rows store the category
 * as a plain string rather than a foreign key, so every chip has to resolve its colour by
 * name rather than by id.
 */
export function buildCategoryAppearanceLookup(categories: Category[]): CategoryAppearanceLookup {
  const lookup: CategoryAppearanceLookup = new Map();

  for (const category of categories) {
    const key = normalizeCategoryName(category.name);
    if (!key) continue;
    // First definition wins, so a duplicate spelling can't override the canonical row.
    if (lookup.has(key)) continue;
    lookup.set(key, { color: category.color, icon: category.icon, isKnown: true });
  }

  return lookup;
}

/**
 * Picks a stable colour for a name with no Category row — a category the user deleted or an
 * imported name they haven't created yet — so historical rows stay visually distinct instead
 * of collapsing into one grey.
 */
function hashNameToFallbackColor(normalizedName: string): string {
  let hash = 0;
  for (let index = 0; index < normalizedName.length; index += 1) {
    hash = (hash * 31 + normalizedName.charCodeAt(index)) % 100000007;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/**
 * Resolves how a category name should be rendered: the user's own colour and icon when the
 * name matches one of their categories, otherwise a hashed colour with no icon.
 */
export function resolveCategoryAppearance(
  name: string | null | undefined,
  lookup: CategoryAppearanceLookup
): CategoryAppearance {
  const normalized = normalizeCategoryName(name ?? "");
  if (!normalized) {
    return { color: UNCATEGORIZED_COLOR, icon: null, isKnown: false };
  }

  const known = lookup.get(normalized);
  if (known) return known;

  return { color: hashNameToFallbackColor(normalized), icon: null, isKnown: false };
}
