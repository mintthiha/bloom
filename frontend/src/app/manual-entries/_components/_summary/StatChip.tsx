import { formatCurrency } from "@/lib/format";

/** Stat chip for the summary row. */
export function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "16px 20px",
        flex: 1,
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          marginBottom: "6px",
        }}
      >
        {label}
      </p>
      <p className="num" style={{ fontSize: "20px", fontWeight: 800, color }}>
        {value >= 0 && label === "Net" ? "+" : ""}
        {formatCurrency(value)}
      </p>
    </div>
  );
}
