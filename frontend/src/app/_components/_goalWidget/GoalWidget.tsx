"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountType, SavingsGoal } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";

const STORAGE_KEY = "bloom_goal_widget_id";

/** Chevron icon that rotates based on collapsed state. */
function CollapseChevron({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
        transition: "transform 0.25s ease",
        display: "block",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** Compact dashboard card showing one selected savings goal with a progress bar. Clicking navigates to /goals. */
export function GoalWidget({ goals }: { goals: SavingsGoal[] }) {
  const router = useRouter();
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
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

  if (goals.length === 0) return null;

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
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/goals")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
            flex: 1,
            minWidth: 0,
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#f59e0b",
            }}
          >
            Goal
          </p>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {goals.length > 1 && !isCollapsed && (
            <select
              value={selectedGoal.id}
              onChange={(e) => handleSelectGoal(e.target.value)}
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
          {!isCollapsed && (
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
                color: "#f59e0b",
              }}
            >
              View all →
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? "Expand goal" : "Collapse goal"}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              borderRadius: "6px",
            }}
          >
            <CollapseChevron isCollapsed={isCollapsed} />
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateRows: isCollapsed ? "0fr" : "1fr",
          transition: "grid-template-rows 0.28s ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => router.push("/goals")}
            style={{
              display: "block",
              width: "100%",
              background: "none",
              border: "none",
              padding: "14px 0 0",
              cursor: "pointer",
              textAlign: "left",
              opacity: isCollapsed ? 0 : 1,
              transition: "opacity 0.2s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
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
        </div>
      </div>
    </div>
  );
}
