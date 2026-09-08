"use client";

import Link from "next/link";
import { ManualEntry } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { CollapsibleCard } from "@/components/collapsible-card";

interface ManualEntriesCardProps {
  entries: ManualEntry[];
}

/** Returns the top N entries by amount descending for a given type. */
function topEntries(entries: ManualEntry[], type: "ASSET" | "LIABILITY", limit: number) {
  return entries
    .filter((e) => e.type === type)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/** Single display row for a manual entry — no editing on the dashboard card. */
function EntryPreviewRow({ entry }: { entry: ManualEntry }) {
  const accentColor = entry.type === "ASSET" ? "#22c55e" : "#ef4444";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 0",
        borderBottom: "1px solid var(--border)",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: accentColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "14px",
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.name}
        </span>
      </div>
      <span
        className="num"
        style={{ fontSize: "14px", fontWeight: 700, color: accentColor, flexShrink: 0 }}
      >
        {formatCurrency(entry.amount)}
      </span>
    </div>
  );
}

/** Dashboard summary card showing top 2 assets and top 2 liabilities, linking to the full management page. */
export function ManualEntriesCard({ entries }: ManualEntriesCardProps) {
  const topAssets = topEntries(entries, "ASSET", 2);
  const topLiabilities = topEntries(entries, "LIABILITY", 2);
  const totalAssets = entries
    .filter((e) => e.type === "ASSET")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalLiabilities = entries
    .filter((e) => e.type === "LIABILITY")
    .reduce((sum, e) => sum + e.amount, 0);
  const net = totalAssets - totalLiabilities;

  return (
    <CollapsibleCard
      eyebrow="Manual Entries"
      title="Assets &amp; liabilities outside Bloom"
      description="Student loans, mortgages, vehicles, and other-bank savings included in your net worth."
      className="fade-up fade-up-3"
    >
      {entries.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "18px" }}>
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "10px 20px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                marginBottom: "6px",
              }}
            >
              Net manual
            </p>
            <p
              className="num"
              style={{
                fontSize: "16px",
                fontWeight: 800,
                color: net >= 0 ? "#22c55e" : "#ef4444",
                whiteSpace: "nowrap",
              }}
            >
              {net >= 0 ? "+" : ""}
              {formatCurrency(net)}
            </p>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div style={{ paddingBottom: "4px" }}>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px" }}>
            No manual entries yet.
          </p>
          <Link
            href="/manual-entries"
            className="press"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#3b82f6",
              background: "#3b82f614",
              border: "1px solid #3b82f633",
              borderRadius: "8px",
              padding: "8px 16px",
              textDecoration: "none",
            }}
          >
            Add student loans, mortgages &amp; more →
          </Link>
        </div>
      ) : (
        <div>
          {topLiabilities.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#ef4444",
                  marginBottom: "2px",
                }}
              >
                Liabilities
              </p>
              {topLiabilities.map((e) => (
                <EntryPreviewRow key={e.id} entry={e} />
              ))}
            </div>
          )}

          {topAssets.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#22c55e",
                  marginBottom: "2px",
                }}
              >
                Assets
              </p>
              {topAssets.map((e) => (
                <EntryPreviewRow key={e.id} entry={e} />
              ))}
            </div>
          )}

          <Link
            href="/manual-entries"
            className="press"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--text-secondary)",
              textDecoration: "none",
              marginTop: "4px",
            }}
          >
            Manage all {entries.length} {entries.length === 1 ? "entry" : "entries"} →
          </Link>
        </div>
      )}
    </CollapsibleCard>
  );
}
