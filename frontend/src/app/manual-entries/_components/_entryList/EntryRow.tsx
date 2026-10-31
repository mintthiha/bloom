"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ManualEntry } from "@/lib/api";
import { deleteWithUndo } from "@/lib/undoableDelete";
import { formatCurrency } from "@/lib/format";
import { inputStyle } from "@/lib/styles/input";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ENTRY_TYPE_LABELS, formatDate } from "../manual-entry-format";

/** Row for an existing manual entry with checkbox, inline edit, and AlertDialog delete. */
export function EntryRow({
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

  const accentColor = entry.type === "ASSET" ? "var(--positive)" : "var(--negative)";

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
              background: "var(--brand-accent)",
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
          aria-label={`Select ${entry.name}`}
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
