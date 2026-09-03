"use client";
import { ActivityLogEntry } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { Activity } from "lucide-react";

const PAGE_SIZE = 25;

const ACTIVITY_META: Record<string, { label: string; color: string; icon: string }> = {
  ACCOUNT_CREATED: { label: "Account created", color: "#22c55e", icon: "+" },
  ACCOUNT_DELETED: { label: "Account deleted", color: "#f87171", icon: "×" },
  ACCOUNT_FROZEN: { label: "Account frozen", color: "#60a5fa", icon: "❄" },
  ACCOUNT_UNFROZEN: { label: "Account unfrozen", color: "#34d399", icon: "✓" },
  ACCOUNT_RENAMED: { label: "Account renamed", color: "#a78bfa", icon: "✎" },
  TRANSACTION_DEPOSIT: { label: "Deposit", color: "#22c55e", icon: "↓" },
  TRANSACTION_WITHDRAWAL: { label: "Withdrawal", color: "#f87171", icon: "↑" },
  TRANSACTION_TRANSFER: { label: "Transfer", color: "#fb923c", icon: "→" },
  TRANSACTION_DELETED: { label: "Transaction deleted", color: "#f87171", icon: "×" },
  TRANSACTION_UPDATED: { label: "Transaction edited", color: "#a78bfa", icon: "✎" },
  TRANSACTION_IMPORTED: { label: "Import", color: "#34d399", icon: "↧" },
  GOAL_CREATED: { label: "Goal created", color: "#22c55e", icon: "★" },
  GOAL_UPDATED: { label: "Goal updated", color: "#a78bfa", icon: "✎" },
  GOAL_DELETED: { label: "Goal deleted", color: "#f87171", icon: "×" },
  BUDGET_CREATED: { label: "Budget created", color: "#22c55e", icon: "$" },
  BUDGET_UPDATED: { label: "Budget updated", color: "#a78bfa", icon: "✎" },
  BUDGET_DELETED: { label: "Budget deleted", color: "#f87171", icon: "×" },
  RECURRING_CREATED: { label: "Recurring created", color: "#22c55e", icon: "↻" },
  RECURRING_DELETED: { label: "Recurring deleted", color: "#f87171", icon: "×" },
};

/** Returns display metadata for an activity type, falling back to a generic entry. */
function activityMeta(type: string) {
  return ACTIVITY_META[type] ?? { label: type, color: "var(--text-secondary)", icon: "•" };
}

interface ActivityFeedProps {
  logs: ActivityLogEntry[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  timeZone: string;
}

/** Renders a paginated list of activity log entries with type badge and timestamp. */
export function ActivityFeed({ logs, total, page, onPageChange, timeZone }: ActivityFeedProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (total === 0) {
    return (
      <EmptyState
        icon={Activity}
        variant="inline"
        title="No activity yet"
        description="Actions like creating accounts, making transactions, and managing goals will appear here."
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {logs.map((log) => {
          const { label, color, icon } = activityMeta(log.type);
          return (
            <div
              key={log.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "14px 16px",
                borderRadius: "10px",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  flexShrink: 0,
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                  color,
                }}
              >
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: "14px",
                    marginBottom: "2px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {log.description}
                </p>
                <p className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  <span
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontSize: "10px",
                      color: "var(--text-secondary)",
                      marginRight: "8px",
                    }}
                  >
                    {label}
                  </span>
                  {new Date(log.createdAt).toLocaleString("en-CA", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone,
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "16px",
            borderTop: "1px solid var(--border)",
            marginTop: "8px",
          }}
        >
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: page === 1 ? "var(--text-muted)" : "var(--text-secondary)",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: page === 1 ? "not-allowed" : "pointer",
            }}
          >
            ← Prev
          </button>
          <span className="num" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {page} / {totalPages} · {total} events
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: page === totalPages ? "var(--text-muted)" : "var(--text-secondary)",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: page === totalPages ? "not-allowed" : "pointer",
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
