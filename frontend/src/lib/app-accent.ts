/**
 * Derivation helpers for the app-wide accent colour (buttons, links, highlights across Bloom).
 * Kept separate from initials-avatar.ts: avatar colour and app accent are independent settings.
 */

/** The colours a user can pick as the app's accent. Stored on the profile as `accentColor`. */
export const ACCENT_COLORS = ["AMBER", "BLUE", "GREEN", "VIOLET", "PINK", "CYAN"] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

/** Solid hex value applied to `--brand-accent`, identical in light and dark mode. */
const ACCENT_HEX: Record<AccentColor, string> = {
  AMBER: "#f59e0b",
  BLUE: "#3b82f6",
  GREEN: "#10b981",
  VIOLET: "#a855f7",
  PINK: "#ec4899",
  CYAN: "#06b6d4",
};

/** The accent applied when the user has not chosen one. */
export const DEFAULT_ACCENT_COLOR: AccentColor = "AMBER";

/** Human-readable swatch list for the profile accent-colour picker, in palette order. */
export const ACCENT_COLOR_OPTIONS: { value: AccentColor; label: string; hex: string }[] =
  ACCENT_COLORS.map((value) => ({
    value,
    label: value.charAt(0) + value.slice(1).toLowerCase(),
    hex: ACCENT_HEX[value],
  }));

/** Narrows an arbitrary stored value to a known accent colour, or null when unrecognized. */
export function parseAccentColor(value: string | null | undefined): AccentColor | null {
  const normalized = (value ?? "").trim().toUpperCase();
  return (ACCENT_COLORS as readonly string[]).includes(normalized)
    ? (normalized as AccentColor)
    : null;
}

/** Resolves the hex value for a stored accent colour, falling back to the default when unset. */
export function getAccentHex(chosenColor?: string | null): string {
  const explicit = parseAccentColor(chosenColor);
  return ACCENT_HEX[explicit ?? DEFAULT_ACCENT_COLOR];
}
