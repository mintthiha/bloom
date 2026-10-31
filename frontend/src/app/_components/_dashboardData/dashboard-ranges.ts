import type { DateRangeQuery } from "@/lib/api";
import type { DashboardView } from "@/components/dashboard-view-provider";

/**
 * The equally long period immediately before `rangeQuery`, used for "vs. last period" deltas.
 * Undefined when there is no range (all time) or the range can't be parsed.
 */
export function buildPreviousRangeQuery(
  rangeQuery: DateRangeQuery | undefined
): DateRangeQuery | undefined {
  if (!rangeQuery?.start || !rangeQuery.end) return undefined;
  const start = new Date(rangeQuery.start);
  const end = new Date(rangeQuery.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  const lengthInMilliseconds = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - lengthInMilliseconds).toISOString(),
    end: start.toISOString(),
  };
}

/** Grid columns for the main card grid, per the user's chosen dashboard view. */
export function getDashboardColumns(view: DashboardView): string {
  if (view === "single") return "1fr";
  if (view === "double") return "repeat(2, minmax(0, 1fr))";
  return "repeat(auto-fit, minmax(340px, 1fr))";
}

/** Grid columns for the skeleton's wide two-up rows. */
export function getTwoColumnGrid(view: DashboardView): string {
  return view === "single" ? "1fr" : "repeat(auto-fit, minmax(480px, 1fr))";
}
