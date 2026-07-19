"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { api, AccountType, SavingsGoal } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { EmptyState } from "@/components/EmptyState";
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
  const progressColor = isComplete ? "#22c55e" : "#3b82f6";

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
          marginBottom: "14px",
          gap: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              marginBottom: "5px",
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
            className="press"
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
            className="press"
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

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <span className="num" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {formatCurrency(goal.currentBalance)} of {formatCurrency(goal.targetAmount)}
          </span>
          <span className="num" style={{ fontSize: "13px", fontWeight: 700, color: progressColor }}>
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

        {isComplete && (
          <p style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600, marginTop: "8px" }}>
            Goal reached!
          </p>
        )}
      </div>
    </div>
  );
}

/** Full list of savings goals with add, edit, and delete actions. */
export function GoalList() {
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
            Set a target balance on any account and track your progress.
          </p>
        </div>
        <button
          type="button"
          className="press"
          onClick={handleOpenCreate}
          style={{
            padding: "10px 18px",
            background: "#3b82f6",
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
            <div key={i} className="skeleton" style={{ height: "130px", borderRadius: "14px" }} />
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
                background: "#3b82f6",
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
    </>
  );
}
