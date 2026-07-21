"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, Budget } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
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

type Props = {
  sourceBudget: Budget;
  budgets: Budget[];
  onChanged: () => Promise<void>;
};

const fieldStyle = {
  width: "100%",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "14px",
  color: "var(--text-primary)",
} as const;

/**
 * Lets the user move part of one envelope's available balance into another for
 * the current month. Backed by an AlertDialog trigger; refreshes on success.
 */
export function MoveBudgetMoneyDialog({ sourceBudget, budgets, onChanged }: Props) {
  const destinations = budgets.filter((budget) => budget.id !== sourceBudget.id);
  const [open, setOpen] = useState(false);
  const [destinationId, setDestinationId] = useState(destinations[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [moving, setMoving] = useState(false);

  /** Validates the amount/destination and posts the transfer between envelopes. */
  async function handleMove(event: React.MouseEvent) {
    // Keep the dialog open until the move actually succeeds (Radix closes it by default).
    event.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!destinationId) {
      toast.error("Choose a destination envelope");
      return;
    }
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setMoving(true);
    try {
      await api.moveBudgetMoney({
        fromBudgetId: sourceBudget.id,
        toBudgetId: destinationId,
        amount: parsedAmount,
        month: sourceBudget.month,
      });
      const destination = destinations.find((budget) => budget.id === destinationId);
      toast.success(
        `Moved ${formatCurrency(parsedAmount)} to ${destination?.category ?? "envelope"}`
      );
      setAmount("");
      setOpen(false);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move money");
    } finally {
      setMoving(false);
    }
  }

  if (destinations.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="budget-action-pill"
        style={{
          padding: "6px 12px",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Move money
      </button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!moving) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <div style={{ padding: "12px 14px" }}>
            <AlertDialogHeader>
              <AlertDialogTitle>Move money from {sourceBudget.category}</AlertDialogTitle>
              <AlertDialogDescription>
                {formatCurrency(sourceBudget.available)} available this month. Move part of it into
                another envelope.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "14px 0" }}
            >
              <select
                value={destinationId}
                onChange={(event) => setDestinationId(event.target.value)}
                aria-label="Destination envelope"
                style={fieldStyle}
              >
                {destinations.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.category}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Amount"
                aria-label="Amount to move"
                style={fieldStyle}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel type="button" onClick={() => setOpen(false)} disabled={moving}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={(event) => handleMove(event)}
                disabled={moving}
              >
                {moving ? "Moving..." : "Move"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
