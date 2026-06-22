"use client";
import { api } from "@/lib/api";
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
  onDeleted: () => void;
  onError: (message: string) => void;
};

export function DeleteTransaction({
  accountId,
  pendingTransactionId,
  onPendingChange,
  deletingTransactionId,
  onDeletingChange,
  editingTransactionId,
  onCancelEditing,
  onDeleted,
  onError,
}: DeleteTransactionProps) {
  /** Calls the delete API, cancels any active edit on that transaction, then notifies the parent. */
  async function handleDelete(transactionId: string) {
    onDeletingChange(transactionId);
    try {
      await api.deleteTransaction(accountId, transactionId);
      if (editingTransactionId === transactionId) onCancelEditing();
      onDeleted();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete transaction");
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
              This will remove the transaction and replay the account balance history.
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
