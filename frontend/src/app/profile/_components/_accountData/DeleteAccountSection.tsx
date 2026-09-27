"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface DeleteAccountSectionProps {
  email: string | null;
}

/**
 * Danger zone: permanently erases the account and everything in it, then signs the user
 * out. Unlike deletes elsewhere in Bloom there is no undo, so the confirm spells that out.
 */
export function DeleteAccountSection({ email }: DeleteAccountSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /** Erases the account, then ends the session so the user lands back on the login page. */
  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      await api.deleteUserAccount();
      toast.success("Account deleted");
      await signOut({ callbackUrl: "/login" });
    } catch {
      toast.error("Couldn't delete your account");
      setIsDeleting(false);
      setIsDialogOpen(false);
    }
  }

  return (
    <div
      style={{
        marginTop: "16px",
        paddingTop: "16px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "3px", color: "#f87171" }}>
        Delete my account
      </p>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
        Erases your profile, accounts, transactions, budgets, and goals for good. Export your data
        first — this one can&apos;t be undone.
      </p>
      <button
        type="button"
        className="danger-action-button"
        onClick={() => setIsDialogOpen(true)}
        disabled={isDeleting}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          padding: "9px 14px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: isDeleting ? "default" : "pointer",
        }}
      >
        <Trash2 size={13} />
        Delete account
      </button>

      <ConfirmDeleteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={`Delete ${email ?? "your Bloom account"}?`}
        description="Every account, transaction, budget, goal, and reminder is erased immediately, and there is no undo. Download your data first if you want to keep a copy."
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
