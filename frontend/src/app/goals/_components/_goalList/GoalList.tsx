"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { api, SavingsGoal } from "@/lib/api";
import { deleteWithUndo } from "@/lib/undoableDelete";
import { formatCurrency } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { GoalCard } from "./GoalCard";
import { GoalFormDialog } from "./GoalFormDialog";

/** Full list of savings goals with add, edit, and delete actions. */
export function GoalList() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  const pendingDeleteGoal = goals.find((goal) => goal.id === pendingDeleteId) ?? null;

  /** Re-fetches the savings goal list (used after create, edit, delete, and undo). */
  const reloadGoals = useCallback(async () => {
    try {
      setGoals(await api.listSavingsGoals());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load goals");
    }
  }, []);

  /** Loads all savings goals for the user on mount. */
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

  /** Soft-deletes the goal with a 5-second undo toast, then refreshes the list. */
  async function handleDelete(goalId: string) {
    setDeletingId(goalId);
    try {
      await deleteWithUndo({
        entityLabel: "Goal",
        remove: () => api.deleteSavingsGoal(goalId),
        restore: () => api.restoreSavingsGoal(goalId),
        onChange: reloadGoals,
      });
    } catch {
      // deleteWithUndo already surfaced the failure toast.
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              marginBottom: "4px",
            }}
          >
            Goals
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Set a target balance and a date, and see what it takes each month to get there.
          </p>
        </div>
        <button
          type="button"
          className="press"
          onClick={handleOpenCreate}
          style={{
            padding: "10px 18px",
            background: "var(--brand-accent)",
            border: "none",
            borderRadius: "10px",
            color: "#000",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          + New goal
        </button>
      </div>

      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: "170px", borderRadius: "14px" }} />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No savings goals yet"
          description="Set a target balance on any account and track your progress toward it."
          action={
            <button
              type="button"
              className="press"
              onClick={handleOpenCreate}
              style={{
                padding: "10px 20px",
                background: "var(--brand-accent)",
                border: "none",
                borderRadius: "10px",
                color: "#000",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Add your first goal
            </button>
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
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

      <ConfirmDeleteDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) setPendingDeleteId(null);
        }}
        title={pendingDeleteGoal ? `Delete "${pendingDeleteGoal.name}"?` : "Delete goal?"}
        description={
          pendingDeleteGoal
            ? `${formatCurrency(pendingDeleteGoal.currentBalance)} of ${formatCurrency(
                pendingDeleteGoal.targetAmount
              )} saved. Deleting the goal does not touch the money in ${pendingDeleteGoal.accountName}.`
            : "This savings goal will be removed."
        }
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
        isDeleting={Boolean(deletingId)}
      />
    </>
  );
}
