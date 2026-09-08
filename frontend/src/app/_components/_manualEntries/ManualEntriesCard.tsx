"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ManualEntry, ManualEntryType } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { CollapsibleCard } from "@/components/collapsible-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { inputStyle } from "@/lib/styles/input";

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

interface ManualEntriesCardProps {
  entries: ManualEntry[];
  onEntriesChange: (entries: ManualEntry[]) => void;
  onNetWorthRefresh: () => void;
}

/** Splits entries into assets and liabilities and returns totals for the header summary. */
function computeTotals(entries: ManualEntry[]) {
  const totalAssets = entries
    .filter((e) => e.type === "ASSET")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalLiabilities = entries
    .filter((e) => e.type === "LIABILITY")
    .reduce((sum, e) => sum + e.amount, 0);
  return { totalAssets, totalLiabilities };
}

/** Inline row for an existing manual entry supporting edit and delete. */
function EntryRow({
  entry,
  onUpdated,
  onDeleted,
}: {
  entry: ManualEntry;
  onUpdated: (updated: ManualEntry) => void;
  onDeleted: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(entry.name);
  const [editAmount, setEditAmount] = useState(String(entry.amount));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  /** Saves the updated name and amount via the API and notifies the parent. */
  async function handleSave() {
    const amount = parseFloat(editAmount);
    if (!editName.trim() || isNaN(amount) || amount <= 0) {
      toast.error("Name and a positive amount are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await api.updateManualEntry(entry.id, { name: editName.trim(), amount });
      onUpdated(updated);
      setIsEditing(false);
      toast.success(`${updated.name} updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update entry");
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Deletes the entry after confirmation and notifies the parent. */
  async function handleConfirmDelete() {
    setIsSubmitting(true);
    try {
      await api.deleteManualEntry(entry.id);
      onDeleted(entry.id);
      toast.success(`${entry.name} deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete entry");
    } finally {
      setIsSubmitting(false);
      setPendingDeleteId(null);
    }
  }

  const accentColor = entry.type === "ASSET" ? "#22c55e" : "#ef4444";

  if (isEditing) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px auto auto",
          gap: "8px",
          alignItems: "center",
          padding: "10px 0",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <input
          style={{ ...inputStyle, fontSize: "13px", padding: "6px 10px" }}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          maxLength={100}
        />
        <input
          style={{ ...inputStyle, fontSize: "13px", padding: "6px 10px" }}
          type="number"
          min="0.01"
          step="0.01"
          value={editAmount}
          onChange={(e) => setEditAmount(e.target.value)}
        />
        <button
          className="press"
          onClick={handleSave}
          disabled={isSubmitting}
          style={{
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "7px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            opacity: isSubmitting ? 0.6 : 1,
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
          }}
          style={{
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "7px",
            padding: "6px 10px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
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
          padding: "10px 0",
          borderBottom: "1px solid var(--border)",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: accentColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "14px",
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <span className="num" style={{ fontSize: "14px", fontWeight: 700, color: accentColor }}>
            {formatCurrency(entry.amount)}
          </span>
          <button
            className="press"
            onClick={() => setIsEditing(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: "12px",
              padding: "2px 6px",
            }}
          >
            Edit
          </button>
          <button
            className="press"
            onClick={() => setPendingDeleteId(entry.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ef4444",
              fontSize: "12px",
              padding: "2px 6px",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <AlertDialog
        open={pendingDeleteId === entry.id}
        onOpenChange={() => setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{entry.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This {ENTRY_TYPE_LABELS[entry.type].toLowerCase()} ({formatCurrency(entry.amount)})
              will be removed from your net worth and health score calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isSubmitting}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Inline form to add a new manual asset or liability. */
function AddEntryForm({ onCreated }: { onCreated: (entry: ManualEntry) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ManualEntryType>("LIABILITY");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestions = type === "LIABILITY" ? SUGGESTED_LIABILITIES : SUGGESTED_ASSETS;

  /** Submits the new manual entry to the API and notifies the parent on success. */
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
      });
      onCreated(created);
      setName("");
      setAmount("");
      toast.success(`${created.name} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          marginBottom: "10px",
        }}
      >
        Add entry
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px 100px auto",
          gap: "8px",
          alignItems: "end",
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
            Name
          </label>
          <input
            style={{ ...inputStyle, fontSize: "13px", padding: "8px 10px" }}
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
            style={{ ...inputStyle, fontSize: "13px", padding: "8px 10px" }}
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
              fontSize: "11px",
              color: "var(--text-muted)",
              marginBottom: "4px",
            }}
          >
            Type
          </label>
          <select
            style={{ ...inputStyle, fontSize: "13px", padding: "8px 10px" }}
            value={type}
            onChange={(e) => setType(e.target.value as ManualEntryType)}
          >
            <option value="LIABILITY">Liability</option>
            <option value="ASSET">Asset</option>
          </select>
        </div>
        <button
          type="submit"
          className="press"
          disabled={isSubmitting}
          style={{
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            opacity: isSubmitting ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          Add
        </button>
      </div>
    </form>
  );
}

/** Dashboard card for managing manual assets and liabilities outside Bloom accounts (e.g. student loans, mortgages). */
export function ManualEntriesCard({
  entries,
  onEntriesChange,
  onNetWorthRefresh,
}: ManualEntriesCardProps) {
  const { totalAssets, totalLiabilities } = computeTotals(entries);

  const assets = entries.filter((e) => e.type === "ASSET");
  const liabilities = entries.filter((e) => e.type === "LIABILITY");

  /** Replaces one entry in the list after an update and refreshes the net worth snapshot. */
  function handleEntryUpdated(updated: ManualEntry) {
    onEntriesChange(entries.map((e) => (e.id === updated.id ? updated : e)));
    onNetWorthRefresh();
  }

  /** Removes a deleted entry from the list and refreshes the net worth snapshot. */
  function handleEntryDeleted(id: string) {
    onEntriesChange(entries.filter((e) => e.id !== id));
    onNetWorthRefresh();
  }

  /** Appends a newly created entry and refreshes the net worth snapshot. */
  function handleEntryCreated(created: ManualEntry) {
    onEntriesChange([...entries, created]);
    onNetWorthRefresh();
  }

  const headerRight =
    entries.length > 0 ? (
      <div style={{ textAlign: "right" }}>
        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
            marginBottom: "4px",
          }}
        >
          Net manual
        </p>
        <p
          className="num"
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: totalAssets - totalLiabilities >= 0 ? "#22c55e" : "#ef4444",
          }}
        >
          {totalAssets - totalLiabilities >= 0 ? "+" : ""}
          {formatCurrency(totalAssets - totalLiabilities)}
        </p>
      </div>
    ) : undefined;

  return (
    <CollapsibleCard
      eyebrow="Manual Entries"
      title="Assets &amp; liabilities outside Bloom"
      description="Add student loans, mortgages, vehicles, or other-bank savings so your net worth and health score reflect your full picture."
      headerRight={headerRight}
      className="fade-up fade-up-3"
    >
      {liabilities.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#ef4444",
              marginBottom: "4px",
            }}
          >
            Liabilities — {formatCurrency(totalLiabilities)}
          </p>
          {liabilities.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              onUpdated={handleEntryUpdated}
              onDeleted={handleEntryDeleted}
            />
          ))}
        </div>
      )}

      {assets.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#22c55e",
              marginBottom: "4px",
            }}
          >
            Assets — {formatCurrency(totalAssets)}
          </p>
          {assets.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              onUpdated={handleEntryUpdated}
              onDeleted={handleEntryDeleted}
            />
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px" }}>
          No manual entries yet. Add a student loan, mortgage, or other asset below.
        </p>
      )}

      <AddEntryForm onCreated={handleEntryCreated} />
    </CollapsibleCard>
  );
}
