import { toast } from "sonner";

/** How long the "Undo" affordance stays on screen after a soft delete. */
export const UNDO_WINDOW_MS = 5000;

type DeleteWithUndoOptions = {
  /** Human-readable name of the thing being deleted, e.g. "Transaction", "Budget". */
  entityLabel: string;
  /** Performs the soft delete (a DELETE request). Rejects on failure. */
  remove: () => Promise<unknown>;
  /** Reverses the soft delete (a POST .../restore request). Rejects on failure. */
  restore: () => Promise<unknown>;
  /** Re-fetches whatever list/summary the caller renders, after both delete and undo. */
  onChange: () => void | Promise<void>;
};

/**
 * Runs a soft delete, refreshes the caller's data, then shows a 5-second toast
 * whose "Undo" action calls the restore endpoint and refreshes again. Centralises
 * the create/delete toast rule so every destructive action is reversible.
 */
export async function deleteWithUndo({
  entityLabel,
  remove,
  restore,
  onChange,
}: DeleteWithUndoOptions): Promise<void> {
  try {
    await remove();
  } catch (error) {
    toast.error(
      error instanceof Error && error.message
        ? error.message
        : `Couldn't delete ${entityLabel.toLowerCase()}`
    );
    throw error;
  }

  await onChange();

  toast.success(`${entityLabel} deleted`, {
    duration: UNDO_WINDOW_MS,
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await restore();
          await onChange();
          toast.success(`${entityLabel} restored`);
        } catch (error) {
          toast.error(
            error instanceof Error && error.message
              ? error.message
              : `Couldn't undo — ${entityLabel.toLowerCase()} stays deleted`
          );
        }
      },
    },
  });
}
