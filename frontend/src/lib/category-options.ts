/** Curated colour swatches offered when creating or editing a category. */
export const CATEGORY_COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#22c55e", label: "Green" },
  { value: "#10b981", label: "Emerald" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#a855f7", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
  { value: "#64748b", label: "Slate" },
];

/** Quick-pick emoji shown above the icon input; the field also accepts free typed emoji. */
export const CATEGORY_ICON_QUICK_PICKS = [
  "🛒",
  "🏠",
  "💡",
  "🚌",
  "🍽️",
  "🛍️",
  "🩺",
  "🎬",
  "📦",
  "💼",
  "💻",
  "🎁",
  "📈",
  "💰",
  "🎮",
  "📚",
  "✈️",
  "🐾",
  "👶",
  "☕",
];

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Validates a colour value against the same hex format the backend requires. */
export function isValidCategoryColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export const MAX_CATEGORY_NAME_LENGTH = 40;
export const MAX_CATEGORY_ICON_LENGTH = 8;

/**
 * Validates a category name for the create/edit form, returning an error message
 * or null when the name is usable.
 */
export function validateCategoryName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required";
  if (trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
    return `Name must be at most ${MAX_CATEGORY_NAME_LENGTH} characters`;
  }
  return null;
}
