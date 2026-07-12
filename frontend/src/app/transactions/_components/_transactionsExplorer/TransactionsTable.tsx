"use client";

import { CSSProperties } from "react";
import { Receipt } from "lucide-react";
import { TransactionListItem } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { TRANSACTION_TYPE_META } from "@/lib/constants/transaction";
import { EmptyState } from "@/components/EmptyState";

/** Formats an ISO date string as "Jan 15, 2026" for the table's date column. */
function formatTransactionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

interface TransactionsTableProps {
  rows: TransactionListItem[];
  loading: boolean;
  hasActiveFilters: boolean;
  onRowClick: (row: TransactionListItem) => void;
}

/** Renders the transactions as a sortable data table, with loading skeleton and empty states. */
export function TransactionsTable({
  rows,
  loading,
  hasActiveFilters,
  onRowClick,
}: TransactionsTableProps) {
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
        icon={Receipt}
        title="No transactions found"
        description={
          hasActiveFilters
            ? "No transactions match the current filters. Try widening your search or clearing filters."
            : "Once you add deposits, withdrawals, or transfers, they'll show up here."
        }
      />
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: "760px", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={headerCellStyle}>Date</th>
            <th style={headerCellStyle}>Description</th>
            <th style={headerCellStyle}>Category</th>
            <th style={headerCellStyle}>Account</th>
            <th style={headerCellStyle}>Type</th>
            <th style={{ ...headerCellStyle, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const meta = TRANSACTION_TYPE_META[row.type] ?? { label: row.type, isInflow: false };
            const amountColor = meta.isInflow ? "#22c55e" : "#f87171";
            const amountSign = meta.isInflow ? "+" : "−";

            return (
              <tr
                key={row.id}
                onClick={() => onRowClick(row)}
                style={{ cursor: "pointer", transition: "background 0.12s" }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "var(--hover-overlay)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                }}
              >
                <td
                  className="num"
                  style={{ ...bodyCellStyle, color: "var(--text-secondary)", whiteSpace: "nowrap" }}
                >
                  {formatTransactionDate(row.effectiveAt)}
                </td>
                <td style={{ ...bodyCellStyle, fontWeight: 600, maxWidth: "280px" }}>
                  <span
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.merchant ?? row.description ?? "Transaction"}
                  </span>
                </td>
                <td style={{ ...bodyCellStyle, color: "var(--text-secondary)" }}>
                  {row.category ?? "—"}
                </td>
                <td style={{ ...bodyCellStyle, color: "var(--text-secondary)" }}>
                  <span
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "160px",
                    }}
                  >
                    {row.accountNickname ?? row.accountName}
                  </span>
                </td>
                <td style={bodyCellStyle}>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      padding: "2px 7px",
                      borderRadius: "999px",
                      whiteSpace: "nowrap",
                      background: meta.isInflow ? "#22c55e1a" : "#f871711a",
                      border: `1px solid ${meta.isInflow ? "#22c55e40" : "#f8717140"}`,
                      color: amountColor,
                    }}
                  >
                    {meta.label}
                  </span>
                </td>
                <td
                  className="num"
                  style={{
                    ...bodyCellStyle,
                    textAlign: "right",
                    fontWeight: 700,
                    color: amountColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {amountSign}
                  {formatCurrency(row.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
