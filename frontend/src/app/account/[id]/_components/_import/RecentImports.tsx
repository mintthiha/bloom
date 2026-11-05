"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ImportBatchSummary } from "@/lib/api";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { countTransactions } from "./import-duplicates";
import { describeUndoImport, formatImportDateRange, formatImportedOn } from "./recent-imports";

type RecentImportsProps = {
  accountId: string;
  /** Bumped by the parent after each import so the list reloads with the new batch. */
  refreshKey: number;
  onImportUndone: () => void;
};

/** Lists the account's recent CSV imports, each with a confirmed "Undo" that removes the whole import. */
export function RecentImports({ accountId, refreshKey, onImportUndone }: RecentImportsProps) {
  const [importBatches, setImportBatches] = useState<ImportBatchSummary[]>([]);
  const [pendingUndoBatch, setPendingUndoBatch] = useState<ImportBatchSummary | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  /** Reloads the recent imports whenever the account changes or a new import lands. */
  useEffect(() => {
    let isCancelled = false;
    api
      .listImportBatches(accountId)
      .then((batches) => {
        if (!isCancelled) setImportBatches(batches);
      })
      .catch(() => {
        // The list is a convenience; the import itself still works without it.
        if (!isCancelled) setImportBatches([]);
      });
    return () => {
      isCancelled = true;
    };
  }, [accountId, refreshKey]);

  /** Removes every transaction from the pending import, then drops it from the list and refreshes the account. */
  async function handleConfirmUndo() {
    if (!pendingUndoBatch) return;
    setIsUndoing(true);
    try {
      const result = await api.undoImportBatch(accountId, pendingUndoBatch.importBatchId);
      setImportBatches((batches) =>
        batches.filter((batch) => batch.importBatchId !== pendingUndoBatch.importBatchId)
      );
      toast.success(`Import undone — ${countTransactions(result.removed)} removed`);
      setPendingUndoBatch(null);
      onImportUndone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't undo the import");
    } finally {
      setIsUndoing(false);
    }
  }

  if (importBatches.length === 0) return null;

  const undoConfirmation = pendingUndoBatch ? describeUndoImport(pendingUndoBatch) : null;

  return (
    <section
      aria-label="Recent imports"
      style={{
        borderTop: "1px solid var(--border)",
        paddingTop: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <h3
        style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--text-muted)",
        }}
      >
        Recent imports
      </h3>
      <ul style={{ display: "flex", flexDirection: "column", gap: "6px", listStyle: "none" }}>
        {importBatches.map((batch) => (
          <li
            key={batch.importBatchId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "8px",
              padding: "8px 10px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          >
            <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                {countTransactions(batch.transactionCount)}
                <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>
                  {" "}
                  · {formatImportDateRange(batch)}
                </span>
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {formatImportedOn(batch)}
              </span>
            </span>
            <button
              type="button"
              className="transaction-delete-button"
              onClick={() => setPendingUndoBatch(batch)}
              style={{ padding: "5px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              Undo
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDeleteDialog
        open={pendingUndoBatch !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isUndoing) setPendingUndoBatch(null);
        }}
        title={undoConfirmation?.title ?? ""}
        description={undoConfirmation?.description ?? ""}
        onConfirm={handleConfirmUndo}
        isDeleting={isUndoing}
        confirmLabel="Remove"
      />
    </section>
  );
}
