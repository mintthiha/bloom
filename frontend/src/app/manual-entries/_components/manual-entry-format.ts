import type { ManualEntryType } from "@/lib/api";

/** Display names for each manual entry type. */
export const ENTRY_TYPE_LABELS: Record<ManualEntryType, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
};

/** Returns today as a YYYY-MM-DD string in local time. */
export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Formats a YYYY-MM-DD date string for display (e.g. "Sep 8, 2026"). */
export function formatDate(date: string | null): string {
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month as number) - 1, day as number).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
