import { AppError } from "../middleware/errorHandler";

/** Named accent colours a user can pick per account, so accounts of the same type are still distinguishable. */
export const ACCOUNT_COLORS = [
  "AMBER",
  "BLUE",
  "GREEN",
  "VIOLET",
  "PINK",
  "CYAN",
  "RED",
  "SLATE",
] as const;

/** Emoji a user can pick to represent an account's institution or purpose at a glance. */
export const ACCOUNT_ICONS = [
  "🏦",
  "🏛️",
  "💳",
  "💰",
  "🐷",
  "🎓",
  "✈️",
  "🏠",
  "🚗",
  "☕",
  "🛒",
  "🎮",
  "💼",
  "🎁",
  "⭐",
  "❤️",
] as const;

export type AccountColor = (typeof ACCOUNT_COLORS)[number];
export type AccountIcon = (typeof ACCOUNT_ICONS)[number];

/**
 * Validates that an optional account colour belongs to the allowed set, uppercasing it first
 * so callers can accept either casing from the client. Returns null for absent values so
 * they clear the stored column.
 */
export function normalizeAccountColor(value: unknown): AccountColor | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new AppError(400, "color must be a string");
  }
  const normalized = value.trim().toUpperCase();
  if (!(ACCOUNT_COLORS as readonly string[]).includes(normalized)) {
    throw new AppError(400, `color must be one of: ${ACCOUNT_COLORS.join(", ")}`);
  }
  return normalized as AccountColor;
}

/**
 * Validates that an optional account icon belongs to the curated emoji set. Case is left
 * untouched since emoji have no casing. Returns null for absent values so they clear the
 * stored column.
 */
export function normalizeAccountIcon(value: unknown): AccountIcon | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new AppError(400, "icon must be a string");
  }
  const normalized = value.trim();
  if (!(ACCOUNT_ICONS as readonly string[]).includes(normalized)) {
    throw new AppError(400, `icon must be one of: ${ACCOUNT_ICONS.join(", ")}`);
  }
  return normalized as AccountIcon;
}
