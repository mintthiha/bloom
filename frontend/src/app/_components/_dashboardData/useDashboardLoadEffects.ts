import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { runApplyDueRecurringTransactions } from "../_recurringTransactions/apply-due-recurring";

/**
 * Keeps a ref pointing at the latest `reload`. The run-once effects below call it through the
 * ref: listing `reload` as a dependency would re-run them whenever the date range changes —
 * which, for the deletion toast, could fire it twice before the URL is cleaned up.
 */
function useLatestReload(reload: () => Promise<void>) {
  const reloadRef = useRef(reload);
  /** Points the ref at the newest reload after each change. */
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);
  return reloadRef;
}

/** Applies any recurring transactions that came due since the last visit, once per page load. */
export function useApplyDueRecurringOnLoad(reload: () => Promise<void>) {
  const reloadRef = useLatestReload(reload);

  /** Runs the catch-up once, then reloads if anything was applied. */
  useEffect(() => {
    let isCancelled = false;

    async function applyDueOnLoad() {
      try {
        const result = await runApplyDueRecurringTransactions();
        if (isCancelled) return;
        if (result.appliedCount > 0) {
          toast.success(
            `Applied ${result.appliedCount} recurring transaction${result.appliedCount === 1 ? "" : "s"}`
          );
          await reloadRef.current();
        }
      } catch {
        // Silent: the recurring card's manual "Apply due" button surfaces failures explicitly.
      }
    }

    applyDueOnLoad();
    return () => {
      isCancelled = true;
    };
  }, [reloadRef]);
}

/**
 * Shows a toast (with a 5s "Undo") when returning from an account deletion, which the account
 * page signals with `?deleted=<name>&deletedId=<id>`, then cleans the URL.
 *
 * The effect can run more than once for one deletion — React StrictMode runs effects twice in
 * development, and the dashboard can remount while the URL still carries the params — so the
 * toast has a stable id (sonner replaces rather than stacks a toast with the same id) and a ref
 * skips repeat runs. Otherwise a second "deleted" toast lingers after Undo.
 */
export function useAccountDeletedToast(reload: () => Promise<void>) {
  const reloadRef = useLatestReload(reload);
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledDeletionRef = useRef<string | null>(null);

  /** Reads the deletion params and turns them into a toast once. */
  useEffect(() => {
    const deleted = searchParams.get("deleted");
    const deletedId = searchParams.get("deletedId");
    if (!deleted) {
      // URL cleaned up: a later deletion (even of the same account) should toast again.
      handledDeletionRef.current = null;
      return;
    }

    const toastId = `account-deleted-${deletedId ?? deleted}`;
    if (handledDeletionRef.current === toastId) return;
    handledDeletionRef.current = toastId;

    if (deletedId) {
      toast.success(`${deleted} deleted`, {
        id: toastId,
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await api.restoreAccount(deletedId);
              await reloadRef.current();
              toast.success(`${deleted} restored`);
            } catch (error) {
              toast.error(
                error instanceof Error && error.message
                  ? error.message
                  : "Couldn't undo — account stays deleted"
              );
            }
          },
        },
      });
    } else {
      toast.success(`${deleted} deleted`, { id: toastId });
    }
    router.replace("/");
  }, [searchParams, router, reloadRef]);
}
