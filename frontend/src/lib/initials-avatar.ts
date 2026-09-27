/**
 * Derivation helpers for the initials avatar shown in the header menu and on the profile page.
 * Kept free of React so the initials and colour selection can be unit-tested on their own.
 */

export type AvatarPalette = {
  /** Fill behind the initials. */
  background: string;
  /** Ring around the avatar when it is not focused/open. */
  border: string;
  /** Colour of the initials themselves. */
  text: string;
};

/**
 * Deterministic palette options. Each entry pairs a translucent fill with a solid
 * accent so the initials stay readable in both light and dark themes.
 */
const AVATAR_PALETTES: AvatarPalette[] = [
  { background: "#f59e0b22", border: "#f59e0b55", text: "#f59e0b" },
  { background: "#3b82f622", border: "#3b82f655", text: "#3b82f6" },
  { background: "#10b98122", border: "#10b98155", text: "#10b981" },
  { background: "#a855f722", border: "#a855f755", text: "#a855f7" },
  { background: "#ec489922", border: "#ec489955", text: "#ec4899" },
  { background: "#06b6d422", border: "#06b6d455", text: "#06b6d4" },
];

/** Palette used when there is no name or handle to hash yet. */
const FALLBACK_PALETTE: AvatarPalette = AVATAR_PALETTES[0];

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

/**
 * Picks a stable palette for a person so their avatar colour never changes between
 * renders or pages. Hashes the seed with a simple FNV-style accumulation.
 */
export function getAvatarPalette(seed: string | null | undefined): AvatarPalette {
  const normalizedSeed = (seed ?? "").trim().toLowerCase();
  if (!normalizedSeed) {
    return FALLBACK_PALETTE;
  }

  let hash = 0;
  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash = (hash * 31 + normalizedSeed.charCodeAt(index)) % 100000007;
  }

  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}
