import { AppError } from "../middleware/errorHandler";
import { ACCOUNT_COLORS, normalizeAccountColor } from "./accountOptions";

/**
 * Goals use the same named accent palette as accounts, so a "Blue" goal and a "Blue"
 * account render identically across the app.
 */
export const SAVINGS_GOAL_COLORS = ACCOUNT_COLORS;

export type SavingsGoalColor = (typeof SAVINGS_GOAL_COLORS)[number];

/** Curated emoji a user can pick to give a goal a face ("✈️ Japan trip", "🏠 Down payment"). */
export const SAVINGS_GOAL_ICONS = [
  "🎯",
  "🏠",
  "🚗",
  "✈️",
  "🎓",
  "💍",
  "👶",
  "🐾",
  "💻",
  "📱",
  "🛋️",
  "🩺",
  "🎄",
  "🎁",
  "🌴",
  "🛟",
  "💰",
  "🐷",
] as const;

export type SavingsGoalIcon = (typeof SAVINGS_GOAL_ICONS)[number];

/** Longest "why this matters" note a goal can carry, kept short so it stays a one-liner on the card. */
export const SAVINGS_GOAL_NOTE_MAX_LENGTH = 280;

/**
 * Validates that an optional goal colour belongs to the shared accent palette. Returns null
 * for absent values so they clear the stored column.
 */
export function normalizeSavingsGoalColor(value: unknown): SavingsGoalColor | null {
  return normalizeAccountColor(value);
}

/**
 * Validates that an optional goal icon belongs to the curated emoji set. Case is left
 * untouched since emoji have no casing. Returns null for absent values so they clear the
 * stored column.
 */
export function normalizeSavingsGoalIcon(value: unknown): SavingsGoalIcon | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new AppError(400, "icon must be a string");
  }
  const normalized = value.trim();
  if (!(SAVINGS_GOAL_ICONS as readonly string[]).includes(normalized)) {
    throw new AppError(400, `icon must be one of: ${SAVINGS_GOAL_ICONS.join(", ")}`);
  }
  return normalized as SavingsGoalIcon;
}
