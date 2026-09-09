"use client";
import { api } from "@/lib/api";
import { deleteWithUndo } from "@/lib/undoableDelete";
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

type DeleteTransactionProps = {
  accountId: string;
  pendingTransactionId: string | null;
  onPendingChange: (id: string | null) => void;
  deletingTransactionId: string | null;
  onDeletingChange: (id: string | null) => void;
  editingTransactionId: string | null;
  onCancelEditing: () => void;
  /** Re-fetches the account + transactions; called after both the delete and any undo. */
  onChange: () => void | Promise<void>;
};

export function DeleteTransaction({
  accountId,
  pendingTransactionId,
  onPendingChange,
  deletingTransactionId,
  onDeletingChange,
  editingTransactionId,
  onCancelEditing,
  onChange,
}: DeleteTransactionProps) {
  /** Soft-deletes the transaction with a 5s undo toast, cancelling any active edit on it. */
  async function handleDelete(transactionId: string) {
    onDeletingChange(transactionId);
    try {
      await deleteWithUndo({
        entityLabel: "Transaction",
        remove: () => api.deleteTransaction(accountId, transactionId),
        restore: () => api.restoreTransaction(accountId, transactionId),
        onChange,
      });
      if (editingTransactionId === transactionId) onCancelEditing();
    } catch {
      // deleteWithUndo already surfaced the failure toast.
    } finally {
      onDeletingChange(null);
      onPendingChange(null);
    }
  }

  return (
    <AlertDialog
      open={pendingTransactionId !== null}
      onOpenChange={(open) => {
        if (!open && !deletingTransactionId) onPendingChange(null);
      }}
    >
      <AlertDialogContent>
        <div style={{ padding: "12px 14px" }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the transaction and replay the account balance history. You can undo
              this for a few seconds afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              type="button"
              onClick={() => onPendingChange(null)}
              disabled={Boolean(deletingTransactionId)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => pendingTransactionId && handleDelete(pendingTransactionId)}
              disabled={Boolean(deletingTransactionId)}
            >
              {deletingTransactionId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
