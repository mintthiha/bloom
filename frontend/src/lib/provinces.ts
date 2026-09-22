import type { ProvinceCode } from "@/lib/api";

/** Canadian provinces and territories, ordered for display in the profile form. */
export const PROVINCE_OPTIONS: { value: ProvinceCode; label: string }[] = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
];

/** Returns the full province name for a code, or null when unset/unknown. */
export function getProvinceLabel(code: ProvinceCode | null): string | null {
  return PROVINCE_OPTIONS.find((option) => option.value === code)?.label ?? null;
}
