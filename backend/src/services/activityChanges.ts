/** How a changed field's before/after values should be rendered in an activity description. */
export type ActivityFieldChangeKind = "currency" | "date" | "text";

/** One field that changed between the previous and new state of an updated record. */
export type ActivityFieldChange = {
  field: string;
  label: string;
  kind: ActivityFieldChangeKind;
  from: string | number | null;
  to: string | number | null;
};

/** Renders a single field-change value for the activity description ("$50.00", "Rent", "none"). */
function formatActivityChangeValue(kind: ActivityFieldChangeKind, value: string | number | null) {
  if (value === null || value === "") return "none";
  if (kind === "currency") return `$${Number(value).toFixed(2)}`;
  return String(value);
}

/**
 * Compares a before/after pair for one field and appends it to `changes` if the value differs.
 * Call once per field when building an `_UPDATED` activity log entry.
 */
export function pushActivityFieldChange(
  changes: ActivityFieldChange[],
  field: string,
  label: string,
  kind: ActivityFieldChangeKind,
  from: string | number | null,
  to: string | number | null
): void {
  if (from !== to) {
    changes.push({ field, label, kind, from, to });
  }
}

/**
 * Renders a list of field changes as "Label $50.00 → $75.00, Label2 A → B" for an activity
 * description. Returns `fallback` when nothing changed.
 */
export function describeActivityFieldChanges(
  changes: ActivityFieldChange[],
  fallback: string
): string {
  if (changes.length === 0) return fallback;
  return changes
    .map(
      (change) =>
        `${change.label} ${formatActivityChangeValue(change.kind, change.from)} → ${formatActivityChangeValue(change.kind, change.to)}`
    )
    .join(", ");
}
