"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, Transaction } from "@/lib/api";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants/account";
import { formatCurrency } from "@/lib/format";
import { inputStyle } from "@/lib/styles/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SplitRow = { category: string; amount: string; description: string };

type SplitTransactionDialogProps = {
  accountId: string;
  transaction: Transaction | null;
  onOpenChange: (open: boolean) => void;
  /** Re-fetches the account + transactions after a split is saved or cleared. */
  onChange: () => void | Promise<void>;
};

/** Builds the starting split rows for a transaction: its existing splits, or two blank rows seeded from its own category. */
function buildInitialRows(transaction: Transaction): SplitRow[] {
  if (transaction.splits.length > 0) {
    return transaction.splits.map((split) => ({
      category: split.category,
      amount: split.amount.toFixed(2),
      description: split.description ?? "",
    }));
  }
  return [
    {
      category: transaction.category ?? "",
      amount: transaction.amount.toFixed(2),
      description: "",
    },
    { category: "", amount: "", description: "" },
  ];
}

/** Splits (or edits/removes the split on) a deposit or withdrawal into multiple category line items. */
export function SplitTransactionDialog({
  accountId,
  transaction,
  onOpenChange,
  onChange,
}: SplitTransactionDialogProps) {
  const [rows, setRows] = useState<SplitRow[]>([]);
  const [lastEditedAmountIndex, setLastEditedAmountIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingSplit, setRemovingSplit] = useState(false);
  // Keeps rendering the last-open transaction's fields while the dialog's close
  // animation plays, since `transaction` itself flips to null immediately.
  const [displayTransaction, setDisplayTransaction] = useState<Transaction | null>(null);

  /** Reseeds the row state and remembers the transaction being displayed whenever a new one opens. */
  useEffect(() => {
    if (transaction) {
      setRows(buildInitialRows(transaction));
      setDisplayTransaction(transaction);
    }
  }, [transaction]);

  const shown = transaction ?? displayTransaction;
  if (!shown) return null;

  const categoryOptions = shown.type === "DEPOSIT" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const total = rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  const remaining = Math.round((shown.amount - total) * 100) / 100;
  const hasExistingSplit = shown.splits.length > 0;

  // Auto-fix skips still-blank rows whenever another row already has an amount to weight the
  // split by, so a mixed set of blank and valued "other" rows means at least one will be left as-is.
  const otherRows = rows.filter((_, i) => i !== lastEditedAmountIndex);
  const autoFixWillSkipABlankRow =
    otherRows.some((row) => !((parseFloat(row.amount) || 0) > 0)) &&
    otherRows.some((row) => (parseFloat(row.amount) || 0) > 0);

  /** Updates a single field of one split row, remembering the row when its amount changes so auto-balance knows which other row to adjust. */
  function updateRow(index: number, field: keyof SplitRow, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    if (field === "amount") {
      setLastEditedAmountIndex(index);
    }
  }

  /**
   * Spreads the unallocated remainder across every row except the one just edited, weighted by
   * each row's current amount, so the split adds back up to the transaction total. A running
   * remainder (rather than rounding each share independently) keeps the distributed cents exact.
   * Still-blank rows (e.g. a freshly added row with no amount yet) sit out of the split rather
   * than being forced to a value, as long as at least one other row already has an amount to
   * absorb the difference.
   */
  function autoBalanceRemaining() {
    const others = rows
      .map((row, i) => ({ rowIndex: i, amount: parseFloat(row.amount) || 0 }))
      .filter((entry) => entry.rowIndex !== lastEditedAmountIndex);
    if (others.length === 0) return;

    const otherTotal = others.reduce((sum, entry) => sum + entry.amount, 0);
    const participants = otherTotal > 0 ? others.filter((entry) => entry.amount > 0) : others;
    if (participants.length === 0) return;

    const newAmounts = new Map<number, number>();
    let amountLeftToDistribute = remaining;
    let weightLeft = participants.reduce(
      (sum, entry) => sum + (otherTotal > 0 ? entry.amount : 1),
      0
    );

    participants.forEach((entry) => {
      const weight = otherTotal > 0 ? entry.amount : 1;
      const share = weightLeft > 0 ? (amountLeftToDistribute * weight) / weightLeft : 0;
      const roundedShare = Math.round(share * 100) / 100;
      newAmounts.set(entry.rowIndex, Math.round((entry.amount + roundedShare) * 100) / 100);
      amountLeftToDistribute -= roundedShare;
      weightLeft -= weight;
    });

    if ([...newAmounts.values()].some((amount) => amount < 0.01)) {
      toast.error("Not enough left in the other categories to auto-balance");
      return;
    }

    setRows((prev) =>
      prev.map((row, i) =>
        newAmounts.has(i) ? { ...row, amount: newAmounts.get(i)!.toFixed(2) } : row
      )
    );
  }

  /** Appends a blank split row, prefilled with whatever amount remains unallocated. */
  function addRow() {
    setRows((prev) => [
      ...prev,
      { category: "", amount: remaining > 0 ? remaining.toFixed(2) : "", description: "" },
    ]);
  }

  /** Removes a split row, as long as at least two remain. */
  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }

  /** Validates and saves the split, replacing any previous split on this transaction. */
  async function handleSave() {
    const parsedRows = rows.map((row) => ({
      category: row.category.trim(),
      amount: parseFloat(row.amount),
      description: row.description.trim() || undefined,
    }));
    if (parsedRows.some((row) => !row.category)) {
      toast.error("Every split needs a category");
      return;
    }
    if (parsedRows.some((row) => !Number.isFinite(row.amount) || row.amount <= 0)) {
      toast.error("Every split needs a positive amount");
      return;
    }
    if (Math.abs(remaining) >= 0.01) {
      toast.error(`Splits must add up to ${formatCurrency(shown!.amount)}`);
      return;
    }

    setSaving(true);
    try {
      await api.setTransactionSplits(accountId, shown!.id, parsedRows);
      toast.success(`Split into ${parsedRows.length} categories`);
      onOpenChange(false);
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to split transaction");
    } finally {
      setSaving(false);
    }
  }

  /** Removes the existing split, reverting the transaction to its own single category. */
  async function handleRemoveSplit() {
    setRemovingSplit(true);
    try {
      await api.clearTransactionSplits(accountId, shown!.id);
      toast.success("Split removed");
      onOpenChange(false);
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove split");
    } finally {
      setRemovingSplit(false);
    }
  }

  const busy = saving || removingSplit;

  return (
    <AlertDialog open={Boolean(transaction)} onOpenChange={(open) => !busy && onOpenChange(open)}>
      <AlertDialogContent>
        <div style={{ padding: "12px 14px" }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Split transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Divide {formatCurrency(shown.amount)} across multiple categories. Each category counts
              separately toward the 50/30/20 summary and budgets.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
            {rows.map((row, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 110px) auto",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <select
                  aria-label={`Split ${index + 1} category`}
                  value={row.category}
                  onChange={(e) => updateRow(index, "category", e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
                >
                  <option value="">Choose category</option>
                  {categoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {row.category && !categoryOptions.includes(row.category) && (
                    <option value={row.category}>{row.category}</option>
                  )}
                </select>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  aria-label={`Split ${index + 1} amount`}
                  value={row.amount}
                  onChange={(e) => updateRow(index, "amount", e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  className="budget-delete-button"
                  onClick={() => removeRow(index)}
                  disabled={rows.length <= 2 || busy}
                  style={{
                    padding: "8px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: rows.length <= 2 || busy ? "not-allowed" : "pointer",
                    opacity: rows.length <= 2 ? 0.4 : 1,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <button
                type="button"
                className="rule-edit-button"
                onClick={addRow}
                disabled={busy}
                style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                + Add category
              </button>
              {Math.abs(remaining) >= 0.01 && rows.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {autoFixWillSkipABlankRow && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger
                          type="button"
                          style={{
                            color: "var(--text-muted)",
                            cursor: "help",
                            fontSize: "12px",
                            background: "none",
                            border: "none",
                            padding: 0,
                          }}
                        >
                          ⓘ
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          style={{ maxWidth: "220px", padding: "10px 14px" }}
                        >
                          Auto-fix only adjusts rows that already have an amount — a blank row is
                          left as-is until you enter one yourself.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <button
                    type="button"
                    className="rule-edit-button press"
                    onClick={autoBalanceRemaining}
                    disabled={busy}
                    style={{
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    Auto-fix
                  </button>
                </div>
              )}
            </div>

            <p
              className="num"
              style={{
                fontSize: "12px",
                color: Math.abs(remaining) < 0.01 ? "var(--text-muted)" : "#f87171",
              }}
            >
              {Math.abs(remaining) < 0.01
                ? `Fully allocated: ${formatCurrency(total)}`
                : `${formatCurrency(Math.abs(remaining))} ${remaining > 0 ? "remaining" : "over"} of ${formatCurrency(shown.amount)}`}
            </p>
          </div>

          <AlertDialogFooter>
            {hasExistingSplit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemoveSplit}
                disabled={busy}
                className="dialog-footer-button mr-auto min-w-24 px-4"
              >
                {removingSplit ? "Removing..." : "Remove split"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="dialog-footer-button press min-w-24 px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="dialog-footer-button press min-w-24 px-4"
            >
              {saving ? "Saving..." : "Save split"}
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
