"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { api, type ChatActionProposal, type ProposedChatActionStatus } from "@/lib/api";
import { deleteWithUndo } from "@/lib/undoableDelete";
import { describeProposedAction, type DeletionDetails } from "./proposed-action-details";
import { restoreDeletedItem } from "./restore-deleted-item";

type ProposedActionCardProps = {
  proposal: ChatActionProposal;
  /** Tells the chat that owns the conversation what the user did with this draft. */
  onStatusChange: (messageId: string, status: ProposedChatActionStatus) => void;
};

const actionButtonStyle: React.CSSProperties = {
  borderRadius: "10px",
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 600,
};

/**
 * The card under a Bloom AI reply that drafted a budget, savings goal, or categorization rule, or
 * the deletion of one. It shows exactly what would change and acts only when the user confirms —
 * a deletion through a second confirm dialog, as every delete in Bloom does. Once confirmed or
 * dismissed it stays in the conversation as a record of what happened.
 */
export function ProposedActionCard({ proposal, onStatusChange }: ProposedActionCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const details = describeProposedAction(proposal.proposedAction);
  const isPending = proposal.status === "PENDING";
  const isBusy = isConfirming || isDismissing;

  /** Saves the draft through the API, then reports the new status and confirms with a toast. */
  async function handleConfirm() {
    setIsConfirming(true);
    try {
      const outcome = await api.confirmProposedChatAction(proposal.messageId);
      onStatusChange(proposal.messageId, outcome.proposedActionStatus);
      toast.success(details.savedMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  }

  /**
   * Carries out a drafted deletion once the user has confirmed it in the dialog, then reports the
   * new status. The toast offers Undo, which restores the item the way its own page would.
   */
  async function handleConfirmDeletion(deletion: DeletionDetails) {
    setIsConfirming(true);
    try {
      await deleteWithUndo({
        entityLabel: deletion.entityLabel,
        remove: () => api.confirmProposedChatAction(proposal.messageId),
        restore: () => restoreDeletedItem(proposal.proposedAction),
        onChange: () => onStatusChange(proposal.messageId, "CONFIRMED"),
      });
    } catch {
      // deleteWithUndo already surfaced the failure toast; the draft stays pending.
    } finally {
      setIsConfirming(false);
      setIsDeleteDialogOpen(false);
    }
  }

  /** Turns the draft down through the API so it can no longer be saved from another device. */
  async function handleDismiss() {
    setIsDismissing(true);
    try {
      const outcome = await api.dismissProposedChatAction(proposal.messageId);
      onStatusChange(proposal.messageId, outcome.proposedActionStatus);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't dismiss that. Please try again."
      );
    } finally {
      setIsDismissing(false);
    }
  }

  return (
    <section
      aria-label={`${details.eyebrow}: ${details.title}`}
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "var(--surface-2)",
        border: isPending
          ? "1px solid color-mix(in srgb, var(--brand-accent) 40%, transparent)"
          : "1px solid var(--border)",
        borderRadius: "14px",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: isPending ? "var(--brand-accent-text)" : "var(--text-secondary)",
            marginBottom: "4px",
          }}
        >
          {details.eyebrow}
        </div>
        <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
          {details.title}
        </div>
      </div>

      <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
        {details.rows.map((row) => (
          <div
            key={row.label}
            style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}
          >
            <dt style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{row.label}</dt>
            <dd
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
                textAlign: "right",
              }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {details.replacementNote && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>
          {details.replacementNote}
        </p>
      )}

      {isPending && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {details.deletion ? (
            <button
              type="button"
              className="danger-action-button"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isBusy}
              style={{
                ...actionButtonStyle,
                cursor: isBusy ? "not-allowed" : "pointer",
              }}
            >
              {isConfirming ? "Deleting…" : details.confirmLabel}
            </button>
          ) : (
            <button
              type="button"
              className="chat-send"
              onClick={handleConfirm}
              disabled={isBusy}
              style={{
                ...actionButtonStyle,
                border: "none",
                background: "var(--brand-accent)",
                color: "white",
                cursor: isBusy ? "not-allowed" : "pointer",
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              {isConfirming ? "Saving…" : details.confirmLabel}
            </button>
          )}
          <button
            type="button"
            className="budget-action-pill"
            onClick={handleDismiss}
            disabled={isBusy}
            style={{
              ...actionButtonStyle,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {proposal.status === "CONFIRMED" && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontWeight: 600,
              color: "var(--positive)",
            }}
          >
            <Check size={14} aria-hidden />
            {details.deletion ? "Deleted" : "Saved"}
          </span>
          <Link
            href={details.destination.href}
            className="hover:underline"
            style={{ fontWeight: 600, color: "var(--brand-accent-text)" }}
          >
            {details.destination.label}
          </Link>
        </div>
      )}

      {proposal.status === "DISMISSED" && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
          {details.deletion ? "Dismissed — nothing was deleted." : "Dismissed — nothing was saved."}
        </p>
      )}

      {details.deletion && (
        <ConfirmDeleteDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title={details.deletion.dialogTitle}
          description={details.deletion.dialogDescription}
          onConfirm={() => handleConfirmDeletion(details.deletion!)}
          isDeleting={isConfirming}
        />
      )}
    </section>
  );
}
