"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { api, Transaction, TransactionSortKey } from "@/lib/api";
import { transactionListItemsToCsv, buildTransactionsExportFilename } from "./export-csv";

interface ExportCsvButtonProps {
  total: number;
  accountId: string;
  type: string;
  search: string;
  sort: TransactionSortKey;
  start: string | undefined;
  end: string | undefined;
}

/** Fetches all transactions matching the current filters and triggers a CSV download. */
export function ExportCsvButton({
  total,
  accountId,
  type,
  search,
  sort,
  start,
  end,
}: ExportCsvButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  /** Fetches the full result set (bypassing pagination) and downloads it as a CSV file. */
  async function handleExport() {
    if (total === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const result = await api.listTransactions({
        account: accountId || undefined,
        type: (type || undefined) as Transaction["type"] | undefined,
        search: search || undefined,
        sort,
        page: 1,
        limit: total,
        start,
        end,
      });
      const csv = transactionListItemsToCsv(result.rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildTransactionsExportFilename();
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  const isDisabled = total === 0 || isExporting;

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isDisabled}
      className="press"
      title={
        total === 0
          ? "No transactions to export"
          : `Export ${total} transaction${total !== 1 ? "s" : ""} as CSV`
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 600,
        color: isDisabled ? "var(--text-muted)" : "var(--text-secondary)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      <Download size={12} />
      {isExporting ? "Exporting…" : "Export CSV"}
    </button>
  );
}
