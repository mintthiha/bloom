"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type DeleteAccountProps = {
  accountId: string;
  displayName: string;
};

export function DeleteAccount({ accountId, displayName }: DeleteAccountProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /** Deletes the account and redirects to the home page with the account name in the query string. */
  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteAccount(accountId);
      router.push(`/?deleted=${encodeURIComponent(displayName)}`);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (confirmDelete) {
    return (
      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: "32px",
          borderRadius: "10px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setConfirmDelete(false)}
          disabled={deleting}
          style={{
            padding: "6px 12px",
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            borderRadius: "7px",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: deleting ? "not-allowed" : "pointer",
            opacity: deleting ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            padding: "6px 12px",
            border: "1px solid #f8717160",
            background: "#f87171",
            color: "#000",
            borderRadius: "7px",
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: deleting ? "not-allowed" : "pointer",
            opacity: deleting ? 0.5 : 1,
          }}
        >
          {deleting ? "…" : "Confirm"}
        </button>
      </div>
    );
  }

  return (
    /** Shows a delete button that reveals an inline confirmation before proceeding. */
    <button
      onClick={() => setConfirmDelete(true)}
      style={{
        padding: "6px 14px",
        border: "1px solid #f8717130",
        background: "transparent",
        color: "#f87171",
        borderRadius: "7px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        cursor: "pointer",
      }}
    >
      Delete
    </button>
  );
}
