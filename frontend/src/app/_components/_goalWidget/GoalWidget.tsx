"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountType, SavingsGoal } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { CollapsibleCard } from "@/components/collapsible-card";

const STORAGE_KEY = "bloom_goal_widget_id";

/** Compact dashboard card showing one selected savings goal with a progress bar. Clicking navigates to /goals. */
export function GoalWidget({ goals }: { goals: SavingsGoal[] }) {
  const router = useRouter();
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const seededRef = useRef(false);

  /** Seeds the selected goal from localStorage the first time a non-empty goals list arrives. */
  useEffect(() => {
    if (goals.length === 0 || seededRef.current) return;
    seededRef.current = true;
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedExists = stored && goals.some((goal) => goal.id === stored);
    setSelectedGoalId(storedExists ? stored : (goals[0]?.id ?? null));
  }, [goals]);

  /** Persists the newly selected goal id so it survives page reloads. */
  function handleSelectGoal(id: string) {
    setSelectedGoalId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  /** Small muted count shown beside the chevron; stays visible while collapsed so the tile still reads as "GOAL — N saved". */
  const goalCountLabel = (
    <span className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
      {goals.length} saved
    </span>
  );

  if (goals.length === 0) {
    return (
      <CollapsibleCard
        eyebrow="Goal"
        title="No goals yet"
        description="Set a target balance on any account and track your progress toward it."
        headerRight={goalCountLabel}
        className="fade-up fade-up-1"
      >
        <button
          type="button"
          className="press"
          onClick={() => router.push("/goals")}
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
          Set a goal
        </button>
      </CollapsibleCard>
    );
  }

  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? goals[0]!;
  const typeMeta = ACCOUNT_TYPE_META[selectedGoal.accountType as AccountType];
  const isComplete = selectedGoal.percentageReached >= 100;
  const progressColor = isComplete ? "#22c55e" : "#3b82f6";

  return (
    <CollapsibleCard
      eyebrow="Goal"
      title="Track your savings goals"
      description="Progress toward your target balances, updated as your account changes."
      headerRight={goalCountLabel}
      className="fade-up fade-up-1"
    >
      {/* Selector + shortcut row: pick which goal to preview, or jump to the full goals page. */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
        {goals.length > 1 && (
          <select
            aria-label="Pinned savings goal"
            value={selectedGoal.id}
            onChange={(e) => handleSelectGoal(e.target.value)}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "7px",
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              maxWidth: "200px",
            }}
          >
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => router.push("/goals")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
            color: "#3b82f6",
            marginLeft: goals.length > 1 ? "auto" : "0",
          }}
        >
          View all →
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push("/goals")}
        style={{
          display: "block",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.01em" }}>
            {selectedGoal.name}
          </p>
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
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {selectedGoal.accountName}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              height: "8px",
              borderRadius: "999px",
              background: "#ffffff0a",
              overflow: "hidden",
            }}
          >
            <div
              className="goal-progress-fill"
              style={
                {
                  width: "100%",
                  height: "100%",
                  background: progressColor,
                  "--goal-progress": selectedGoal.percentageReached / 100,
                } as CSSProperties
              }
            />
          </div>
          <span
            className="num"
            style={{ fontSize: "13px", fontWeight: 700, color: progressColor, flexShrink: 0 }}
          >
            {selectedGoal.percentageReached.toFixed(0)}%
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "8px",
          }}
        >
          <span className="num" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {formatCurrency(selectedGoal.currentBalance)} of{" "}
            {formatCurrency(selectedGoal.targetAmount)}
          </span>
          {isComplete && (
            <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>
              Goal reached!
            </span>
          )}
        </div>
      </button>
    </CollapsibleCard>
  );
}
