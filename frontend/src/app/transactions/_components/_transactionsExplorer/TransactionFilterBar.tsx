"use client";

import { CSSProperties } from "react";
import { Search, X } from "lucide-react";
import { Account, TransactionSortKey } from "@/lib/api";
import { TRANSACTION_TYPE_OPTIONS } from "@/lib/constants/transaction";

/** Sort options shown in the dropdown, mapped to the API sort keys. */
const SORT_OPTIONS: { value: TransactionSortKey; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Amount: high → low" },
  { value: "amount_asc", label: "Amount: low → high" },
];

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

interface TransactionFilterBarProps {
  accounts: Account[];
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  accountId: string;
  onAccountChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  sort: TransactionSortKey;
  onSortChange: (value: TransactionSortKey) => void;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

/** Controlled filter/search/sort bar for the transactions explorer; owns no state of its own. */
export function TransactionFilterBar({
  accounts,
  searchInput,
  onSearchInputChange,
  accountId,
  onAccountChange,
  type,
  onTypeChange,
  sort,
  onSortChange,
  from,
  onFromChange,
  to,
  onToChange,
  hasActiveFilters,
  onClear,
}: TransactionFilterBarProps) {
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
          placeholder="Search description, merchant, category…"
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

      {/* Account */}
      <select
        aria-label="Filter by account"
        value={accountId}
        onChange={(event) => onAccountChange(event.target.value)}
        style={controlStyle}
      >
        <option value="">All accounts</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.nickname ?? account.ownerName}
          </option>
        ))}
      </select>

      {/* Type */}
      <select
        aria-label="Filter by type"
        value={type}
        onChange={(event) => onTypeChange(event.target.value)}
        style={controlStyle}
      >
        <option value="">All types</option>
        {TRANSACTION_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Sort */}
      <select
        aria-label="Sort transactions"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as TransactionSortKey)}
        style={controlStyle}
      >
        {SORT_OPTIONS.map((option) => (
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
    </div>
  );
}
