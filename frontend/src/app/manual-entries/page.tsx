"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, ManualEntry } from "@/lib/api";
import { UNDO_WINDOW_MS } from "@/lib/undoableDelete";
import { BackToHome } from "@/components/BackToHome";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useLoadFailureBoundary } from "@/hooks/useLoadFailureBoundary";
import { AddEntryForm } from "./_components/_addEntry/AddEntryForm";
import { EntrySection } from "./_components/_entryList/EntrySection";
import { StatChip } from "./_components/_summary/StatChip";

/** Full management page for manual assets and liabilities. */
export default function ManualEntriesPage() {
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const reportLoadFailure = useLoadFailureBoundary();

  /**
   * Loads all manual entries and triggers a net worth snapshot on mount. A failure shows the
   * error page, since an empty list would read as "no assets or liabilities".
   */
  useEffect(() => {
    Promise.all([api.listManualEntries(), api.recordNetWorthSnapshot()])
      .then(([loaded]) => setEntries(loaded))
      .catch(reportLoadFailure)
      .finally(() => setIsLoading(false));
  }, [reportLoadFailure]);

  /** Toggles a single entry's selection. */
  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** Selects or deselects a whole section of entries. */
  function handleSelectAll(ids: string[], select: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) select ? next.add(id) : next.delete(id);
      return next;
    });
  }

  /** Re-fetches the entry list and records a fresh net worth snapshot. */
  async function reloadEntries() {
    try {
      setEntries(await api.listManualEntries());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load entries");
    }
    await api.recordNetWorthSnapshot().catch(() => {});
  }

  /** Soft-deletes all selected entries with a 5-second undo toast, then refreshes. */
  async function handleBulkDelete() {
    setIsBulkDeleting(true);
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => api.deleteManualEntry(id)));
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      await reloadEntries();
      toast.success(`${ids.length} ${ids.length === 1 ? "entry" : "entries"} deleted`, {
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await Promise.allSettled(ids.map((id) => api.restoreManualEntry(id)));
            await reloadEntries();
            const restored = undo.filter((r) => r.status === "fulfilled").length;
            if (restored > 0) {
              toast.success(`${restored} ${restored === 1 ? "entry" : "entries"} restored`);
            }
            if (restored < ids.length) {
              toast.error(
                `${ids.length - restored} ${
                  ids.length - restored === 1 ? "entry" : "entries"
                } couldn't be restored`
              );
            }
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete entries");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  /** Adds a created entry to the list and refreshes the net worth snapshot. */
  async function handleEntryCreated(created: ManualEntry) {
    setEntries((prev) => [created, ...prev]);
    await api.recordNetWorthSnapshot().catch(() => {});
  }

  /** Replaces an updated entry in the list and refreshes the net worth snapshot. */
  async function handleEntryUpdated(updated: ManualEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    await api.recordNetWorthSnapshot().catch(() => {});
  }

  const assets = entries.filter((e) => e.type === "ASSET");
  const liabilities = entries.filter((e) => e.type === "LIABILITY");
  const totalAssets = assets.reduce((sum, e) => sum + e.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, e) => sum + e.amount, 0);
  const net = totalAssets - totalLiabilities;

  const selectedEntries = entries.filter((e) => selectedIds.has(e.id));

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px" }}>
      <BackToHome />

      <div style={{ marginBottom: "32px" }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--brand-accent-text)",
            marginBottom: "8px",
          }}
        >
          Manual Entries
        </p>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "-0.4px",
            marginBottom: "6px",
          }}
        >
          Assets &amp; Liabilities
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", maxWidth: "520px" }}>
          Track student loans, mortgages, vehicles, or savings at other banks so your net worth and
          health score reflect your full financial picture.
        </p>
      </div>

      {/* Summary chips */}
      {entries.length > 0 && (
        <div
          style={{ display: "flex", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}
          className="fade-up"
        >
          <StatChip label="Assets" value={totalAssets} color="var(--positive)" />
          <StatChip label="Liabilities" value={totalLiabilities} color="var(--negative)" />
          <StatChip
            label="Net"
            value={net}
            color={net >= 0 ? "var(--positive)" : "var(--negative)"}
          />
        </div>
      )}

      {/* Add form */}
      <div style={{ marginBottom: "28px" }} className="fade-up fade-up-1">
        <AddEntryForm onCreated={handleEntryCreated} />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "color-mix(in srgb, var(--brand-accent) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--brand-accent) 20%, transparent)",
            borderRadius: "10px",
            padding: "12px 16px",
            marginBottom: "16px",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--brand-accent-text)" }}>
            {selectedIds.size} {selectedIds.size === 1 ? "entry" : "entries"} selected
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="press"
              onClick={() => setSelectedIds(new Set())}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: "7px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
            <button
              className="press"
              onClick={() => setShowBulkDeleteDialog(true)}
              style={{
                background: "#ef444420",
                border: "1px solid #ef444440",
                borderRadius: "7px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--negative)",
                cursor: "pointer",
              }}
            >
              Delete {selectedIds.size}
            </button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {isLoading ? (
        <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            textAlign: "center",
            padding: "32px 0",
          }}
        >
          No entries yet. Add a student loan, mortgage, or other asset above.
        </p>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "24px" }}
          className="fade-up fade-up-2"
        >
          {liabilities.length > 0 && (
            <EntrySection
              label="Liabilities"
              accentColor="var(--negative)"
              total={totalLiabilities}
              entries={liabilities}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onUpdated={handleEntryUpdated}
              onChange={reloadEntries}
            />
          )}
          {assets.length > 0 && (
            <EntrySection
              label="Assets"
              accentColor="var(--positive)"
              total={totalAssets}
              entries={assets}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onUpdated={handleEntryUpdated}
              onChange={reloadEntries}
            />
          )}
        </div>
      )}

      {/* Bulk delete confirmation */}
      <ConfirmDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? "entry" : "entries"}?`}
        description={`${selectedEntries.map((e) => e.name).join(", ")} will be permanently removed from your net worth and health score calculations.`}
        onConfirm={handleBulkDelete}
        isDeleting={isBulkDeleting}
        confirmLabel={`Delete ${selectedIds.size}`}
      />
    </div>
  );
}
