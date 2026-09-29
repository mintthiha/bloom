/**
 * Derivation helpers for the initials avatar shown in the header menu and on the profile page.
 * Kept free of React so the initials and colour selection can be unit-tested on their own.
 */

/** The colours a user can pick for their avatar. Stored on the profile as `avatarColor`. */
export const AVATAR_COLORS = ["AMBER", "BLUE", "GREEN", "VIOLET", "PINK", "CYAN"] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];

export type AvatarPalette = {
  /** Fill behind the initials. */
  background: string;
  /** Ring around the avatar when it is not focused/open. */
  border: string;
  /** Colour of the initials themselves. */
  text: string;
};

/**
 * Each palette pairs a translucent fill with a solid accent for the border, plus a darkened
 * variant of that same hue for the initials text — the full-brightness hue reads well as a
 * border/fill but fails WCAG AA contrast as text against its own faint tint.
 */
const AVATAR_PALETTES: Record<AvatarColor, AvatarPalette> = {
  AMBER: { background: "#f59e0b22", border: "#f59e0b55", text: "#8a5a06" },
  BLUE: { background: "#3b82f622", border: "#3b82f655", text: "#1d4ed8" },
  GREEN: { background: "#10b98122", border: "#10b98155", text: "#047857" },
  VIOLET: { background: "#a855f722", border: "#a855f755", text: "#7e22ce" },
  PINK: { background: "#ec489922", border: "#ec489955", text: "#be185d" },
  CYAN: { background: "#06b6d422", border: "#06b6d455", text: "#0e7490" },
};

/** Human-readable swatch list for the profile colour picker, in palette order. */
export const AVATAR_COLOR_OPTIONS: { value: AvatarColor; label: string; palette: AvatarPalette }[] =
  [
    { value: "AMBER", label: "Amber", palette: AVATAR_PALETTES.AMBER },
    { value: "BLUE", label: "Blue", palette: AVATAR_PALETTES.BLUE },
    { value: "GREEN", label: "Green", palette: AVATAR_PALETTES.GREEN },
    { value: "VIOLET", label: "Violet", palette: AVATAR_PALETTES.VIOLET },
    { value: "PINK", label: "Pink", palette: AVATAR_PALETTES.PINK },
    { value: "CYAN", label: "Cyan", palette: AVATAR_PALETTES.CYAN },
  ];

/** Keeps only letters and digits, so punctuation in a name never becomes an initial. */
function getFirstAlphanumericCharacter(value: string): string {
  const match = value.match(/[\p{L}\p{N}]/u);
  return match ? match[0] : "";
}

/**
 * Builds the one or two characters shown inside the avatar: the first letter of the first
 * and last name, falling back to the first two letters of a handle or email local part,
 * and finally to an empty string so the caller can render a generic icon instead.
 */
export function getAvatarInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallbackLabel?: string | null
): string {
  const firstInitial = getFirstAlphanumericCharacter(firstName ?? "");
  const lastInitial = getFirstAlphanumericCharacter(lastName ?? "");

  if (firstInitial && lastInitial) {
    return (firstInitial + lastInitial).toUpperCase();
  }
  if (firstInitial || lastInitial) {
    return (firstInitial || lastInitial).toUpperCase();
  }

  const fallbackLocalPart = (fallbackLabel ?? "").split("@")[0];
  const fallbackLetters = (fallbackLocalPart.match(/[\p{L}\p{N}]/gu) ?? []).slice(0, 2).join("");
  return fallbackLetters.toUpperCase();
}

/** Narrows an arbitrary stored value to a known avatar colour, or null when unrecognized. */
export function parseAvatarColor(value: string | null | undefined): AvatarColor | null {
  const normalized = (value ?? "").trim().toUpperCase();
  return (AVATAR_COLORS as readonly string[]).includes(normalized)
    ? (normalized as AvatarColor)
    : null;
}

/**
 * Resolves the avatar palette: the user's explicit choice when they have made one, otherwise
 * a colour hashed from their name or handle so it stays stable between renders and pages.
 */
export function getAvatarPalette(
  seed: string | null | undefined,
  chosenColor?: string | null
): AvatarPalette {
  const explicitColor = parseAvatarColor(chosenColor);
  if (explicitColor) {
    return AVATAR_PALETTES[explicitColor];
  }

  const normalizedSeed = (seed ?? "").trim().toLowerCase();
  if (!normalizedSeed) {
    return AVATAR_PALETTES[AVATAR_COLORS[0]];
  }

  let hash = 0;
  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = (hash * 31 + normalizedSeed.charCodeAt(index)) % 100000007;
  }

  return AVATAR_PALETTES[AVATAR_COLORS[hash % AVATAR_COLORS.length]];
}
