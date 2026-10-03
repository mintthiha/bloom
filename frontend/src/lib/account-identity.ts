import { Account } from "@/lib/api";
import { ACCOUNT_COLOR_PALETTES, ACCOUNT_TYPE_META, AccountColor } from "@/lib/constants/account";

export type AccountAppearance = {
  label: string;
  color: string;
  soft: string;
  border: string;
  /** The custom emoji glyph for this account, or null when it should fall back to its initial letter. */
  icon: string | null;
};

/** Narrows an arbitrary stored value to a known account colour, or null when unset/unrecognized. */
export function parseAccountColor(value: string | null | undefined): AccountColor | null {
  const normalized = (value ?? "").trim().toUpperCase();
  return normalized in ACCOUNT_COLOR_PALETTES ? (normalized as AccountColor) : null;
}

/**
 * Resolves how an account should be rendered: its custom colour and icon when the user has
 * picked them, falling back to the account type's default palette and no icon (so the caller
 * shows the account's initial letter instead) otherwise.
 */
export function resolveAccountAppearance(account: Account): AccountAppearance {
  const typeMeta = ACCOUNT_TYPE_META[account.accountType];
  const customColor = parseAccountColor(account.color);
  const palette = customColor ? ACCOUNT_COLOR_PALETTES[customColor] : typeMeta;
  return {
    label: typeMeta.label,
    color: palette.color,
    soft: palette.soft,
    border: palette.border,
    icon: account.icon ?? null,
  };
}
