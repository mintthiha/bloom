"use client";

import { CalendarClock, Target } from "lucide-react";
import { AccountType, SavingsGoal } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { calculateGoalPace, formatTargetDate } from "@/lib/goal-pace";
import { resolveSavingsGoalAppearance } from "@/lib/savings-goal-appearance";

type GoalCardProps = {
  goal: SavingsGoal;
  onEdit: () => void;
  onDelete: () => void;
};

/** Shared styling for the small action buttons in the card header. */
const actionButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: "7px",
  padding: "4px 10px",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
};

/**
 * Renders one savings goal: its emoji and colour, the progress bar, the pace needed to hit
 * the target date, and the user's own reason for saving.
 */
export function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const typeMeta = ACCOUNT_TYPE_META[goal.accountType as AccountType];
  const appearance = resolveSavingsGoalAppearance(goal);
  const pace = calculateGoalPace(goal);
  const targetDateLabel = formatTargetDate(goal.targetDate);
  const isComplete = goal.percentageReached >= 100;

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
        <div style={{ display: "flex", gap: "12px", minWidth: 0 }}>
          <div
            aria-hidden="true"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "11px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              background: appearance.soft,
              border: `1px solid ${appearance.border}`,
            }}
          >
            {appearance.icon ?? <Target size={17} color={appearance.color} />}
          </div>

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
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
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
        </div>

        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button
            type="button"
            className="press"
            onClick={onEdit}
            style={{ ...actionButtonStyle, color: "var(--text-secondary)" }}
          >
            Edit
          </button>
          <button
            type="button"
            className="press"
            onClick={onDelete}
            style={{ ...actionButtonStyle, color: "#ef4444" }}
          >
            Delete
          </button>
        </div>
      </div>

      {targetDateLabel && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            marginBottom: "12px",
            padding: "3px 8px",
            borderRadius: "6px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            fontSize: "11px",
            fontWeight: 600,
            color: pace.status === "PAST_DUE" ? "#ef4444" : "var(--text-secondary)",
          }}
        >
          <CalendarClock size={12} aria-hidden="true" />
          <span>By {targetDateLabel}</span>
        </div>
      )}

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
          <span
            className="num"
            style={{ fontSize: "13px", fontWeight: 700, color: appearance.color }}
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
              background: appearance.color,
              borderRadius: "999px",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <p
          style={{
            fontSize: "11.5px",
            fontWeight: 600,
            marginTop: "8px",
            color: isComplete
              ? "#22c55e"
              : pace.status === "PAST_DUE"
                ? "#ef4444"
                : "var(--text-secondary)",
          }}
        >
          {pace.summary}
        </p>

        {goal.note && (
          <p
            style={{
              fontSize: "12px",
              lineHeight: 1.5,
              marginTop: "10px",
              paddingLeft: "9px",
              borderLeft: `2px solid ${appearance.border}`,
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            {goal.note}
          </p>
        )}
      </div>
    </div>
  );
}
