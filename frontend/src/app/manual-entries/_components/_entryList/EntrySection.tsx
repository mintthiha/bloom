import type { ManualEntry, ManualEntryType } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { EntryRow } from "./EntryRow";

/** Section block (Liabilities or Assets) with a select-all checkbox in the header. */
export function EntrySection({
  label,
  accentColor,
  total,
  entries,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onUpdated,
  onChange,
}: {
  label: string;
  accentColor: string;
  total: number;
  entries: ManualEntry[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[], select: boolean) => void;
  onUpdated: (updated: ManualEntry) => void;
  onChange: () => void | Promise<void>;
}) {
  const allSelected = entries.length > 0 && entries.every((e) => selectedIds.has(e.id));
  const someSelected = entries.some((e) => selectedIds.has(e.id));

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="checkbox"
            aria-label={`Select all ${label.toLowerCase()}`}
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={() =>
              onSelectAll(
                entries.map((e) => e.id),
                !allSelected
              )
            }
            style={{ width: "15px", height: "15px", cursor: "pointer", accentColor }}
          />
          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: accentColor,
            }}
          >
            {label}
          </p>
        </div>
        <span className="num" style={{ fontSize: "14px", fontWeight: 700, color: accentColor }}>
          {formatCurrency(total)}
        </span>
      </div>
      {entries.map((e) => (
        <EntryRow
          key={e.id}
          entry={e}
          isSelected={selectedIds.has(e.id)}
          onToggleSelect={onToggleSelect}
          onUpdated={onUpdated}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
