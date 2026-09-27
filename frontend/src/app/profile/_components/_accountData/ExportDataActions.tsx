"use client";
import { useState } from "react";
import { FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { downloadTextFile } from "@/lib/download-file";
import { buildTransactionsExportFilename, transactionListItemsToCsv } from "@/lib/transactions-csv";
import { ExportDownloadButton } from "./ExportDownloadButton";
import {
  buildUserDataExportFilename,
  buildUserDataJson,
  describeUserDataExport,
} from "./export-user-data";

type ExportFormat = "csv" | "json";

/**
 * Downloads everything Bloom holds for the user: a CSV of every transaction across all
 * accounts (the same columns the importer reads back in), or a JSON file of the whole
 * account — profile, accounts, budgets, goals, and the rest.
 */
export function ExportDataActions() {
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  /** Fetches the export bundle once, then hands the browser the file for the chosen format. */
  async function handleExport(format: ExportFormat) {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      const data = await api.exportUserData();
      if (format === "csv") {
        downloadTextFile(
          buildTransactionsExportFilename(),
          transactionListItemsToCsv(data.transactions),
          "text/csv"
        );
      } else {
        downloadTextFile(
          buildUserDataExportFilename("json"),
          buildUserDataJson(data),
          "application/json"
        );
      }
      toast.success("Data exported", { description: describeUserDataExport(data) });
    } catch {
      toast.error("Couldn't export your data");
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div>
      <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "3px" }}>Export all my data</p>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
        Take a copy with you any time. The CSV holds every transaction in Bloom&apos;s import
        format; the JSON holds your whole account.
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <ExportDownloadButton
          icon={<FileSpreadsheet size={13} />}
          label="Transactions CSV"
          isBusy={exportingFormat === "csv"}
          isDisabled={exportingFormat !== null}
          onClick={() => handleExport("csv")}
        />
        <ExportDownloadButton
          icon={<FileJson size={13} />}
          label="Everything (JSON)"
          isBusy={exportingFormat === "json"}
          isDisabled={exportingFormat !== null}
          onClick={() => handleExport("json")}
        />
      </div>
    </div>
  );
}
