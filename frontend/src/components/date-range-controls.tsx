"use client";

import { DateRangePreset, DateRangeState, shiftLocalDate } from "@/lib/date-range";

export function DateRangeControls({
  value,
  onChange,
}: {
  value: DateRangeState;
  onChange: (nextValue: DateRangeState) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
      <select
        aria-label="Date range preset"
        value={value.preset}
        onChange={(event) => {
          const preset = event.target.value as DateRangePreset;
          if (preset === "custom") {
            onChange({
              ...value,
              preset,
              end: value.preset === "custom" ? value.end : shiftLocalDate(value.end, -1),
            });
            return;
          }

          onChange({ ...value, preset });
        }}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "13px",
          color: "var(--text-primary)",
        }}
      >
        <option value="this-month">This month</option>
        <option value="previous-month">Previous month</option>
        <option value="last-90-days">Last 90 days</option>
        <option value="custom">Custom</option>
      </select>

      {value.preset === "custom" && (
        <>
          <input
            type="date"
            aria-label="Start date"
            value={value.start}
            onChange={(event) => {
              const start = event.target.value;
              onChange({
                ...value,
                start,
                end: value.end && value.end < start ? start : value.end,
              });
            }}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "13px",
              color: "var(--text-primary)",
            }}
          />
          <input
            type="date"
            aria-label="End date"
            value={value.end}
            onChange={(event) => {
              const end = event.target.value;
              onChange({
                ...value,
                start: value.start && end < value.start ? end : value.start,
                end,
              });
            }}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "13px",
              color: "var(--text-primary)",
            }}
          />
        </>
      )}
    </div>
  );
}
