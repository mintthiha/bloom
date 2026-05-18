"use client";

import { Account, Transaction } from "@/lib/api";
import { buildExportFilename, transactionsToCsv } from "./export-csv";

interface ExportCsvButtonProps {
  txns: Transaction[];
  account: Account;
}

/** Downloads the current transaction list as a CSV file compatible with the Bloom import format. */
export function ExportCsvButton({ txns, account }: ExportCsvButtonProps) {
  /** Serializes visible transactions to CSV and triggers a browser download. */
  function handleExport() {
    const csv = transactionsToCsv(txns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildExportFilename(account.nickname ?? account.ownerName);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={txns.length === 0}
      title={txns.length === 0 ? "No transactions to export" : `Export ${txns.length} transaction${txns.length !== 1 ? "s" : ""} as CSV`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 600,
        color: txns.length === 0 ? "var(--text-muted)" : "var(--text-secondary)",
        cursor: txns.length === 0 ? "not-allowed" : "pointer",
        opacity: txns.length === 0 ? 0.5 : 1,
        transition: "border-color 0.15s, color 0.15s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (txns.length > 0) {
          e.currentTarget.style.borderColor = "var(--border-hover)";
          e.currentTarget.style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = txns.length === 0 ? "var(--text-muted)" : "var(--text-secondary)";
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export CSV
    </button>
  );
}
