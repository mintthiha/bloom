import { AppError } from "../middleware/errorHandler";

/** Canadian province and territory codes accepted for the profile's residence field. */
export const PROVINCE_CODES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;

/** How often the user is paid, which drives paycheque-based cashflow estimates. */
export const PAY_FREQUENCIES = ["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY"] as const;

/** The headline goal Bloom tailors its home-page and AI guidance toward. */
export const PRIMARY_FINANCIAL_GOALS = [
  "EMERGENCY_FUND",
  "PAY_OFF_DEBT",
  "BIG_PURCHASE",
  "TRACK_SPENDING",
] as const;

export type ProvinceCode = (typeof PROVINCE_CODES)[number];
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];
export type PrimaryFinancialGoal = (typeof PRIMARY_FINANCIAL_GOALS)[number];

/**
 * Validates that an optional code belongs to the allowed set, uppercasing it first
 * so callers can accept either casing from the client.
 * Returns null for absent values so they clear the stored column.
 */
export function normalizeEnumValue<Allowed extends string>(
  value: unknown,
  field: string,
  allowed: readonly Allowed[]
): Allowed | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new AppError(400, `${field} must be a string`);
  }
  const normalized = value.trim().toUpperCase();
  if (!(allowed as readonly string[]).includes(normalized)) {
    throw new AppError(400, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return normalized as Allowed;
}

/**
 * Parses an optional ISO `YYYY-MM-DD` date string into a UTC Date.
 * Rejects values that are not real calendar dates (e.g. 2026-02-31).
 */
export function parseOptionalDateOnly(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new AppError(400, `${field} must be a YYYY-MM-DD date`);
  }
  const trimmed = value.trim();
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new AppError(400, `${field} must be a valid calendar date`);
  }
  return parsed;
}
