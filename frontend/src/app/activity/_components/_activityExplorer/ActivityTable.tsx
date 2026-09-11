"use client";

import { CSSProperties, useState } from "react";
import { Activity, ChevronRight } from "lucide-react";
import { ActivityLogEntry } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { activityMeta } from "./activity-meta";

/** Formats an ISO timestamp as "Feb 1, 2026, 12:00 p.m." in the viewer's local zone. */
function formatActivityTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const headerCellStyle: CSSProperties = {
  textAlign: "left",
  padding: "0 14px 10px",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--text-muted)",
  whiteSpace: "nowrap",
};

const bodyCellStyle: CSSProperties = {
  padding: "12px 14px",
  fontSize: "13px",
  color: "var(--text-primary)",
  borderTop: "1px solid var(--border)",
  verticalAlign: "middle",
};

interface ActivityTableProps {
  rows: ActivityLogEntry[];
  loading: boolean;
  hasActiveFilters: boolean;
}

/** Renders activity log entries as a data table, with loading skeleton and empty states. */
export function ActivityTable({ rows, loading, hasActiveFilters }: ActivityTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  /** Toggles a row's expanded state, showing its full untruncated activity text. */
  function toggleRow(rowId: string) {
    setExpandedRowId((previous) => (previous === rowId ? null : rowId));
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="skeleton" style={{ height: "46px", borderRadius: "8px" }} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity found"
        description={
          hasActiveFilters
            ? "No events match the current filters. Try widening your search or clearing filters."
            : "Actions like creating accounts, making transactions, and managing goals will appear here."
        }
      />
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, width: "28px" }} />
            <th style={headerCellStyle}>Type</th>
            <th style={headerCellStyle}>Activity</th>
            <th style={{ ...headerCellStyle, textAlign: "right" }}>When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { label, color, icon } = activityMeta(row.type);
            const isExpanded = expandedRowId === row.id;

            return (
              <tr
                key={row.id}
                className="activity-row"
                onClick={() => toggleRow(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleRow(row.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                style={{ cursor: "pointer" }}
              >
                <td style={{ ...bodyCellStyle, padding: "12px 0 12px 14px" }}>
                  <span
                    aria-hidden
                    style={{
                      display: "flex",
                      color: "var(--text-muted)",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    <ChevronRight size={14} />
                  </span>
                </td>
                <td style={bodyCellStyle}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "7px",
                        flexShrink: 0,
                        background: `${color}18`,
                        border: `1px solid ${color}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 700,
                        color,
                      }}
                    >
                      {icon}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {label}
                    </span>
                  </span>
                </td>
                <td style={{ ...bodyCellStyle, fontWeight: 600, maxWidth: "420px" }}>
                  <span
                    title={isExpanded ? undefined : row.description}
                    style={{
                      display: "block",
                      overflow: isExpanded ? "visible" : "hidden",
                      textOverflow: isExpanded ? "clip" : "ellipsis",
                      whiteSpace: isExpanded ? "normal" : "nowrap",
                    }}
                  >
                    {row.description}
                  </span>
                </td>
                <td
                  className="num"
                  style={{
                    ...bodyCellStyle,
                    textAlign: "right",
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatActivityTimestamp(row.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
