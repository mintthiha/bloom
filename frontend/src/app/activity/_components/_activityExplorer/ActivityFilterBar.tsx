"use client";

import { CSSProperties } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { ActivitySortKey } from "@/lib/api";
import {
  ACTIVITY_ACTION_OPTIONS,
  ACTIVITY_GROUP_OPTIONS,
  ACTIVITY_SORT_OPTIONS,
} from "./activity-meta";

/** Shared visual style for the select and date inputs so every control lines up. */
const controlStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "8px 10px",
  fontSize: "13px",
  color: "var(--text-primary)",
  cursor: "pointer",
  minWidth: 0,
};

interface ActivityFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  group: string;
  onGroupChange: (value: string) => void;
  action: string;
  onActionChange: (value: string) => void;
  sort: ActivitySortKey;
  onSortChange: (value: ActivitySortKey) => void;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/** Controlled filter/search/sort bar for the activity explorer; owns no state of its own. */
export function ActivityFilterBar({
  searchInput,
  onSearchInputChange,
  group,
  onGroupChange,
  action,
  onActionChange,
  sort,
  onSortChange,
  from,
  onFromChange,
  to,
  onToChange,
  hasActiveFilters,
  onClear,
  onRefresh,
  refreshing,
}: ActivityFilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "10px",
        marginBottom: "18px",
      }}
    >
      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flex: "1 1 220px",
          minWidth: "180px",
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "8px 10px",
        }}
      >
        <Search size={15} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
        <input
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="Search activity…"
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: "13px",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Group */}
      <select
        aria-label="Filter by category"
        value={group}
        onChange={(event) => onGroupChange(event.target.value)}
        style={controlStyle}
      >
        <option value="">All categories</option>
        {ACTIVITY_GROUP_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Action */}
      <select
        aria-label="Filter by action"
        value={action}
        onChange={(event) => onActionChange(event.target.value)}
        style={controlStyle}
      >
        <option value="">All actions</option>
        {ACTIVITY_ACTION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Sort */}
      <select
        aria-label="Sort activity"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as ActivitySortKey)}
        style={controlStyle}
      >
        {ACTIVITY_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Date range */}
      <input
        type="date"
        aria-label="From date"
        value={from}
        max={to || undefined}
        onChange={(event) => onFromChange(event.target.value)}
        style={controlStyle}
      />
      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>to</span>
      <input
        type="date"
        aria-label="To date"
        value={to}
        min={from || undefined}
        onChange={(event) => onToChange(event.target.value)}
        style={controlStyle}
      />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="press"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "8px 10px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <X size={13} />
          Clear
        </button>
      )}

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh activity"
        className="press"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "8px 10px",
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text-secondary)",
          cursor: refreshing ? "not-allowed" : "pointer",
          opacity: refreshing ? 0.6 : 1,
        }}
      >
        <RefreshCw size={13} className={refreshing ? "activity-refresh-spin" : undefined} />
        Refresh
      </button>
    </div>
  );
}
