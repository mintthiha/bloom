"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, AccountType, SavingsGoal } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";

const STORAGE_KEY = "bloom_goal_widget_id";

/** Compact dashboard card showing one selected savings goal with a progress bar. Clicking navigates to /goals. */
export function GoalWidget() {
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  /** Loads goals and restores the previously selected goal from localStorage. */
  useEffect(() => {
    let cancelled = false;

    api
      .listSavingsGoals()
      .then((data) => {
        if (cancelled) return;
        setGoals(data);
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedExists = stored && data.some((goal) => goal.id === stored);
        setSelectedGoalId(storedExists ? stored : (data[0]?.id ?? null));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Persists the newly selected goal id so it survives page reloads. */
  function handleSelectGoal(id: string) {
    setSelectedGoalId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  if (loading || goals.length === 0) return null;

  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? goals[0]!;
  const typeMeta = ACCOUNT_TYPE_META[selectedGoal.accountType as AccountType];
  const isComplete = selectedGoal.percentageReached >= 100;
  const progressColor = isComplete ? "#22c55e" : "#f59e0b";

  return (
    <div
      className="fade-up fade-up-1"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "20px 24px",
        marginBottom: "20px",
        cursor: "pointer",
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onClick={() => router.push("/goals")}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-hover)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px",
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
          Goal
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {goals.length > 1 && (
            <select
              value={selectedGoal.id}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectGoal(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "7px",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer",
                outline: "none",
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
          <span
            style={{ fontSize: "12px", fontWeight: 600, color: "#f59e0b" }}
          >
            View all →
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <p
          style={{
            fontSize: "15px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
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
            style={{
              width: `${selectedGoal.percentageReached}%`,
              height: "100%",
              background: progressColor,
              borderRadius: "999px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <span
          className="num"
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: progressColor,
            flexShrink: 0,
          }}
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
        <span
          className="num"
          style={{ fontSize: "12px", color: "var(--text-secondary)" }}
        >
          {formatCurrency(selectedGoal.currentBalance)} of{" "}
          {formatCurrency(selectedGoal.targetAmount)}
        </span>
        {isComplete && (
          <span
            style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}
          >
            Goal reached!
          </span>
        )}
      </div>
    </div>
  );
}
