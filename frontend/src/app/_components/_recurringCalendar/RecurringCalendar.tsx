"use client";
import { useMemo } from "react";
import { RecurringTransaction } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { CollapsibleCard } from "@/components/collapsible-card";
import {
  computeUpcomingOccurrences,
  formatRelativeDate,
  groupOccurrencesByMonth,
  OccurrenceStatus,
} from "./recurring-calendar-utils";

type Props = {
  rules: RecurringTransaction[];
};

const STATUS_DOT_COLOR: Record<OccurrenceStatus, string> = {
  overdue: "#f87171",
  "due-soon": "#f59e0b",
  upcoming: "var(--text-muted)",
};

const STATUS_BADGE: Record<OccurrenceStatus, { label: string; color: string; bg: string } | null> =
  {
    overdue: { label: "Overdue", color: "#f87171", bg: "#f8717122" },
    "due-soon": { label: "Due soon", color: "#f59e0b", bg: "#f59e0b22" },
    upcoming: null,
  };

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
};

/** Calendar timeline card showing upcoming recurring transaction occurrences grouped by month. */
export function RecurringCalendar({ rules }: Props) {
  const activeRules = useMemo(() => rules.filter((rule) => rule.active), [rules]);
  const occurrences = useMemo(() => computeUpcomingOccurrences(rules), [rules]);
  const monthGroups = useMemo(() => groupOccurrencesByMonth(occurrences), [occurrences]);

  return (
    <CollapsibleCard
      eyebrow="Upcoming Schedule"
      title="Next 90 days"
      description="Upcoming occurrences from your active recurring rules."
      className="fade-up fade-up-2"
      style={{}}
    >
      {activeRules.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          No active recurring rules. Add or resume a rule to see your upcoming schedule here.
        </p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: "14px",
              flexWrap: "wrap",
              marginBottom: "18px",
            }}
          >
            {(["overdue", "due-soon", "upcoming"] as OccurrenceStatus[]).map((status) => (
              <div
                key={status}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  color:
                    status === "overdue"
                      ? "#f87171"
                      : status === "due-soon"
                        ? "#f59e0b"
                        : "var(--text-secondary)",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: STATUS_DOT_COLOR[status],
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                {status === "overdue" ? "Overdue" : status === "due-soon" ? "Due soon" : "Upcoming"}
              </div>
            ))}
          </div>

          {monthGroups.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              No occurrences in the next 90 days.
            </p>
          ) : (
            monthGroups.map((group) => (
              <div key={group.monthLabel} style={{ marginBottom: "20px" }}>
                <p
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-muted)",
                    marginBottom: "8px",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: "6px",
                  }}
                >
                  {group.monthLabel}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {group.occurrences.map((occurrence) => {
                    const badge = STATUS_BADGE[occurrence.status];
                    const isDeposit = occurrence.rule.type === "DEPOSIT";
                    const dotColor = STATUS_DOT_COLOR[occurrence.status];

                    return (
                      <div
                        key={occurrence.key}
                        style={{
                          background: "var(--surface-2)",
                          border: `1px solid ${
                            occurrence.status !== "upcoming" ? dotColor + "44" : "var(--border)"
                          }`,
                          borderRadius: "10px",
                          padding: "10px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: dotColor,
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                              alignItems: "baseline",
                            }}
                          >
                            <p
                              style={{
                                fontSize: "13px",
                                fontWeight: 700,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {occurrence.rule.merchant || occurrence.rule.name}
                            </p>
                            <span
                              className="num"
                              style={{
                                fontSize: "13px",
                                fontWeight: 700,
                                flexShrink: 0,
                                color: isDeposit ? "#22c55e" : "var(--text-primary)",
                              }}
                            >
                              {isDeposit ? "+" : "−"}
                              {formatCurrency(occurrence.rule.amount)}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "8px",
                              marginTop: "3px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--text-muted)",
                              }}
                            >
                              {formatRelativeDate(occurrence.occurrenceDate)}
                              {" · "}
                              {FREQUENCY_LABEL[occurrence.rule.frequency] ??
                                occurrence.rule.frequency}
                            </span>
                            {badge && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  padding: "2px 7px",
                                  borderRadius: "999px",
                                  background: badge.bg,
                                  color: badge.color,
                                  flexShrink: 0,
                                }}
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </CollapsibleCard>
  );
}
