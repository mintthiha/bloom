"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, ManualEntry, ManualEntryType } from "@/lib/api";
import { deleteWithUndo, UNDO_WINDOW_MS } from "@/lib/undoableDelete";
import { formatCurrency } from "@/lib/format";
import { BackToHome } from "@/components/BackToHome";
import { inputStyle } from "@/lib/styles/input";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

const ENTRY_TYPE_LABELS: Record<ManualEntryType, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
};

const SUGGESTED_LIABILITIES = [
  "Student Loan",
  "Mortgage",
  "Car Loan",
  "Personal Loan",
  "Line of Credit",
];
const SUGGESTED_ASSETS = ["Home", "Vehicle", "Other Bank Account", "Investment Account"];

/** Returns today as a YYYY-MM-DD string in local time. */
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Formats a YYYY-MM-DD date string for display (e.g. "Sep 8, 2026"). */
function formatDate(date: string | null): string {
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month as number) - 1, day as number).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Row for an existing manual entry with checkbox, inline edit, and AlertDialog delete. */
function EntryRow({
  entry,
  isSelected,
  onToggleSelect,
  onUpdated,
  onChange,
}: {
  entry: ManualEntry;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onUpdated: (updated: ManualEntry) => void;
  /** Re-fetches the entry list + net worth; called after both the delete and any undo. */
  onChange: () => void | Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(entry.name);
  const [editAmount, setEditAmount] = useState(String(entry.amount));
  const [editDate, setEditDate] = useState(entry.date ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const accentColor = entry.type === "ASSET" ? "#22c55e" : "#ef4444";

  /** Saves edited name, amount, and date via the API and notifies the parent. */
  async function handleSave() {
    const amount = parseFloat(editAmount);
    if (!editName.trim() || isNaN(amount) || amount <= 0) {
      toast.error("Name and a positive amount are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await api.updateManualEntry(entry.id, {
        name: editName.trim(),
        amount,
        date: editDate || null,
      });
      onUpdated(updated);
      setIsEditing(false);
      toast.success(`${updated.name} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update entry");
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Soft-deletes the entry with a 5-second undo toast, then refreshes the parent list. */
  async function handleConfirmDelete() {
    setIsSubmitting(true);
    try {
      await deleteWithUndo({
        entityLabel: entry.type === "ASSET" ? "Asset" : "Liability",
        remove: () => api.deleteManualEntry(entry.id),
        restore: () => api.restoreManualEntry(entry.id),
        onChange,
      });
    } catch {
      // deleteWithUndo already surfaced the failure toast.
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  }

  if (isEditing) {
    return (
      <div
        style={{
          padding: "14px 0",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "8px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Name
            </label>
            <input
              style={{ ...inputStyle, fontSize: "13px", padding: "7px 10px" }}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Amount
            </label>
            <input
              style={{ ...inputStyle, fontSize: "13px", padding: "7px 10px" }}
              type="number"
              min="0.01"
              step="0.01"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
            />
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: "8px",
            alignItems: "flex-end",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              As of date (optional)
            </label>
            <input
              style={{ ...inputStyle, fontSize: "13px", padding: "7px 6px 7px 10px" }}
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
          </div>
          <button
            className="press"
            onClick={handleSave}
            disabled={isSubmitting}
            style={{
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              opacity: isSubmitting ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            Save
          </button>
          <button
            className="press"
            onClick={() => {
              setIsEditing(false);
              setEditName(entry.name);
              setEditAmount(String(entry.amount));
              setEditDate(entry.date ?? "");
            }}
            style={{
              background: "var(--surface-2)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 0",
          borderBottom: "1px solid var(--border)",
          gap: "12px",
        }}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(entry.id)}
          style={{ width: "15px", height: "15px", flexShrink: 0, cursor: "pointer", accentColor }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: accentColor,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: "1px",
              }}
            >
              {entry.name}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>{formatDate(entry.date)}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <span className="num" style={{ fontSize: "15px", fontWeight: 700, color: accentColor }}>
            {formatCurrency(entry.amount)}
          </span>
          <button className="entry-action-edit" onClick={() => setIsEditing(true)}>
            Edit
          </button>
          <button className="entry-action-delete" onClick={() => setShowDeleteDialog(true)}>
            Delete
          </button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete "${entry.name}"?`}
        description={`This ${ENTRY_TYPE_LABELS[entry.type].toLowerCase()} (${formatCurrency(entry.amount)}) will be removed from your net worth and health score calculations.`}
        onConfirm={handleConfirmDelete}
        isDeleting={isSubmitting}
      />
    </>
  );
}

/** Section block (Liabilities or Assets) with a select-all checkbox in the header. */
function EntrySection({
  label,
  accentColor,
  total,
  entries,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onUpdated,
  onChange,
}: {
  label: string;
  accentColor: string;
  total: number;
  entries: ManualEntry[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[], select: boolean) => void;
  onUpdated: (updated: ManualEntry) => void;
  onChange: () => void | Promise<void>;
}) {
  const allSelected = entries.length > 0 && entries.every((e) => selectedIds.has(e.id));
  const someSelected = entries.some((e) => selectedIds.has(e.id));

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={() =>
              onSelectAll(
                entries.map((e) => e.id),
                !allSelected
              )
            }
            style={{ width: "15px", height: "15px", cursor: "pointer", accentColor }}
          />
          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: accentColor,
            }}
          >
            {label}
          </p>
        </div>
        <span className="num" style={{ fontSize: "14px", fontWeight: 700, color: accentColor }}>
          {formatCurrency(total)}
        </span>
      </div>
      {entries.map((e) => (
        <EntryRow
          key={e.id}
          entry={e}
          isSelected={selectedIds.has(e.id)}
          onToggleSelect={onToggleSelect}
          onUpdated={onUpdated}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

/** Form to add a new manual asset or liability with an optional as-of date. */
function AddEntryForm({ onCreated }: { onCreated: (entry: ManualEntry) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ManualEntryType>("LIABILITY");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestions = type === "LIABILITY" ? SUGGESTED_LIABILITIES : SUGGESTED_ASSETS;

  /** Submits the new manual entry and refreshes the list on success. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!name.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Name and a positive amount are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await api.createManualEntry({
        name: name.trim(),
        type,
        amount: parsedAmount,
        date: date || null,
      });
      onCreated(created);
      setName("");
      setAmount("");
      setDate(todayString());
      toast.success(`${created.name} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#3b82f6",
          marginBottom: "16px",
        }}
      >
        Add entry
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            Name
          </label>
          <input
            style={{ ...inputStyle, fontSize: "14px" }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Student Loan"
            maxLength={100}
            list="manual-entry-suggestions"
          />
          <datalist id="manual-entry-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 110px minmax(160px, 1fr)",
            gap: "12px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Amount
            </label>
            <input
              style={{ ...inputStyle, fontSize: "14px" }}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Type
            </label>
            <select
              style={{ ...inputStyle, fontSize: "14px" }}
              value={type}
              onChange={(e) => setType(e.target.value as ManualEntryType)}
            >
              <option value="LIABILITY">Liability</option>
              <option value="ASSET">Asset</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              As of date
            </label>
            <input
              style={{ ...inputStyle, fontSize: "14px", paddingRight: "6px" }}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="press"
            disabled={isSubmitting}
            style={{
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "Adding…" : "Add entry"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Stat chip for the summary row. */
function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "16px 20px",
        flex: 1,
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          marginBottom: "6px",
        }}
      >
        {label}
      </p>
      <p className="num" style={{ fontSize: "20px", fontWeight: 800, color }}>
        {value >= 0 && label === "Net" ? "+" : ""}
        {formatCurrency(value)}
      </p>
    </div>
  );
}

/** Full management page for manual assets and liabilities. */
export default function ManualEntriesPage() {
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  /** Loads all manual entries and triggers a net worth snapshot on mount. */
  useEffect(() => {
    Promise.all([api.listManualEntries(), api.recordNetWorthSnapshot()])
      .then(([loaded]) => setEntries(loaded))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load entries"))
      .finally(() => setIsLoading(false));
  }, []);

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
            color: "#3b82f6",
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
          <StatChip label="Assets" value={totalAssets} color="#22c55e" />
          <StatChip label="Liabilities" value={totalLiabilities} color="#ef4444" />
          <StatChip label="Net" value={net} color={net >= 0 ? "#22c55e" : "#ef4444"} />
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
            background: "#3b82f614",
            border: "1px solid #3b82f633",
            borderRadius: "10px",
            padding: "12px 16px",
            marginBottom: "16px",
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#3b82f6" }}>
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
                color: "#ef4444",
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
              accentColor="#ef4444"
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
              accentColor="#22c55e"
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
