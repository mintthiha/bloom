"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, AccountType, SavingsGoal } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
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
import { GoalFormDialog } from "./GoalFormDialog";

/** Renders a single savings goal card with progress bar and action buttons. */
function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: SavingsGoal;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeMeta = ACCOUNT_TYPE_META[goal.accountType as AccountType];
  const isComplete = goal.percentageReached >= 100;
  const progressColor = isComplete ? "#22c55e" : "#f59e0b";

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "10px",
          gap: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              marginBottom: "4px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {goal.name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {goal.accountName}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: "4px",
                background: typeMeta.soft,
                border: `1px solid ${typeMeta.border}`,
                color: typeMeta.color,
                letterSpacing: "0.04em",
              }}
            >
              {typeMeta.label}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={onEdit}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "7px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "7px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 600,
              color: "#ef4444",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6px",
          }}
        >
          <span className="num" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {formatCurrency(goal.currentBalance)} of {formatCurrency(goal.targetAmount)}
          </span>
          <span
            className="num"
            style={{ fontSize: "13px", fontWeight: 700, color: progressColor }}
          >
            {goal.percentageReached.toFixed(0)}%
          </span>
        </div>

        <div
          style={{
            height: "8px",
            borderRadius: "999px",
            background: "#ffffff0a",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${goal.percentageReached}%`,
              height: "100%",
              background: progressColor,
              borderRadius: "999px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {isComplete && (
        <p style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>
          Goal reached!
        </p>
      )}
    </div>
  );
}

/** Section showing all user savings goals with add, edit, and delete actions. */
export function SavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  /** Loads all savings goals for the user. */
  useEffect(() => {
    let cancelled = false;

    async function loadGoals() {
      try {
        const data = await api.listSavingsGoals();
        if (!cancelled) setGoals(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load goals");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGoals();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Opens the form dialog in create mode. */
  function handleOpenCreate() {
    setEditingGoal(null);
    setFormDialogOpen(true);
  }

  /** Opens the form dialog in edit mode for the given goal. */
  function handleOpenEdit(goal: SavingsGoal) {
    setEditingGoal(goal);
    setFormDialogOpen(true);
  }

  /** Updates local state after a goal is created or edited. */
  function handleSaved(savedGoal: SavingsGoal) {
    setGoals((previous) =>
      editingGoal
        ? previous.map((goal) => (goal.id === savedGoal.id ? savedGoal : goal))
        : [...previous, savedGoal]
    );
    setFormDialogOpen(false);
    setEditingGoal(null);
  }

  /** Deletes the goal and removes it from local state. */
  async function handleDelete(goalId: string) {
    setDeletingId(goalId);
    try {
      await api.deleteSavingsGoal(goalId);
      setGoals((previous) => previous.filter((goal) => goal.id !== goalId));
      toast.success("Goal deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete goal");
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  }

  return (
    <div style={{ marginTop: "28px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-secondary)",
          }}
        >
          Goals
        </p>
        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            padding: "6px 14px",
            background: "#f59e0b",
            border: "none",
            borderRadius: "8px",
            color: "#000",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Add goal
        </button>
      </div>

      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          <div className="skeleton" style={{ height: "112px", borderRadius: "14px" }} />
          <div className="skeleton" style={{ height: "112px", borderRadius: "14px" }} />
        </div>
      ) : goals.length === 0 ? (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
            No savings goals yet. Add a goal to start tracking progress.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => handleOpenEdit(goal)}
              onDelete={() => setPendingDeleteId(goal.id)}
            />
          ))}
        </div>
      )}

      {formDialogOpen && (
        <GoalFormDialog
          goal={editingGoal}
          onClose={() => {
            setFormDialogOpen(false);
            setEditingGoal(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <div style={{ padding: "12px 14px" }}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete goal?</AlertDialogTitle>
              <AlertDialogDescription>
                This savings goal will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                onClick={() => setPendingDeleteId(null)}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={() => pendingDeleteId && handleDelete(pendingDeleteId)}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
