"use client";

import { AccountSortKey, ACCOUNT_SORT_OPTIONS } from "@/lib/account-view";

interface SortControlProps {
  value: AccountSortKey;
  onChange: (key: AccountSortKey) => void;
}

/** Segmented control for choosing how the account list is ordered; "Manual" re-enables drag-to-reorder. */
export function SortControl({ value, onChange }: SortControlProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
        }}
      >
        Sort
      </span>
      {ACCOUNT_SORT_OPTIONS.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            className="nav-item"
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            style={{
              minHeight: "32px",
              padding: "0 12px",
              borderRadius: "8px",
              border: active
                ? "1px solid color-mix(in srgb, var(--brand-accent) 40%, transparent)"
                : "1px solid var(--border)",
              background: active
                ? "color-mix(in srgb, var(--brand-accent) 10%, transparent)"
                : "var(--surface-1)",
              color: active ? "var(--brand-accent)" : "var(--text-secondary)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
