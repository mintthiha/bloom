import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/format";

type TooltipPayloadItem = {
  name?: string | number;
  value?: string | number;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

interface ChartTooltipProps {
  /** Injected by recharts when a data point is hovered. */
  active?: boolean;
  /** Injected by recharts: the series values at the hovered point. */
  payload?: TooltipPayloadItem[];
  /** Injected by recharts: the x-axis value at the hovered point. */
  label?: string | number;
  /** Maps a series dataKey (or name) to a friendly label shown in the row. */
  nameMap?: Record<string, string>;
  /** Formats each value; receives the full payload item for bespoke cases. Defaults to formatCurrency. */
  valueFormatter?: (value: number, item: TooltipPayloadItem) => ReactNode;
  /** Formats the header label (e.g. an ISO date or month key). */
  labelFormatter?: (label: string | number) => ReactNode;
  /** Hides the header label row entirely (useful for pie/donut charts). */
  hideLabel?: boolean;
}

/** Themed tooltip for all recharts graphs: surface card, per-series color dots, and tabular-num values. */
export function ChartTooltip({
  active,
  payload,
  label,
  nameMap,
  valueFormatter = (value) => formatCurrency(value),
  labelFormatter,
  hideLabel = false,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "10px 12px",
        boxShadow: "0 8px 24px -8px rgba(0, 0, 0, 0.45)",
        minWidth: "148px",
      }}
    >
      {!hideLabel && label !== undefined && label !== "" && (
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: "8px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index);
          const displayName = nameMap?.[key] ?? String(item.name ?? key);
          return (
            <div
              key={index}
              style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: item.color ?? "var(--text-muted)",
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--text-secondary)", flex: 1, whiteSpace: "nowrap" }}>
                {displayName}
              </span>
              <span
                className="num"
                style={{ color: "var(--text-primary)", fontWeight: 600, marginLeft: "16px" }}
              >
                {valueFormatter(Number(item.value), item)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
