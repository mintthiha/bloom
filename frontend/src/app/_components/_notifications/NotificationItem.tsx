"use client";
import {
  CalendarClock,
  PartyPopper,
  PieChart,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { AppNotification, NotificationKind } from "@/lib/api";
import {
  classifyReminderUrgency,
  formatDueLabel,
  KIND_ACCENT,
  ReminderUrgency,
} from "./notification-utils";

type Props = {
  notification: AppNotification;
  onActivate: (notification: AppNotification) => void;
  onDismiss: (notification: AppNotification) => void;
};

const URGENCY_COLOR: Record<ReminderUrgency, string> = {
  overdue: "#f87171",
  "due-soon": "#3b82f6",
  upcoming: "var(--text-muted)",
};

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  BILL_REMINDER: CalendarClock,
  LOW_BALANCE: Wallet,
  BUDGET_OVERSPEND: PieChart,
  GOAL_REACHED: PartyPopper,
  SUBSCRIPTION_PRICE: TrendingUp,
};

/** A single notification row: kind icon, title/body, due label, and dismiss control. */
export function NotificationItem({ notification, onActivate, onDismiss }: Props) {
  const isUnread = notification.status === "UNREAD";
  const isBill = notification.kind === "BILL_REMINDER";
  const urgency = classifyReminderUrgency(notification.dueDate);
  // Bills signal urgency by color; other kinds use their fixed accent.
  const accent = isBill ? URGENCY_COLOR[urgency] : KIND_ACCENT[notification.kind];
  const dueLabel = formatDueLabel(notification.dueDate);
  const Icon = KIND_ICON[notification.kind];
  const isClickable = Boolean(notification.linkHref);

  /** Activates the row (mark read + navigate) via click or keyboard. */
  function handleActivate() {
    onActivate(notification);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate();
        }
      }}
      className="notification-item"
      style={{
        position: "relative",
        background: isUnread ? "var(--surface-2)" : "transparent",
        border: `1px solid ${urgency !== "upcoming" && isBill ? accent + "44" : "var(--border)"}`,
        borderRadius: "10px",
        padding: "12px 14px",
        display: "flex",
        gap: "11px",
        alignItems: "flex-start",
        cursor: isClickable ? "pointer" : "default",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "8px",
          background: accent === "var(--text-muted)" ? "var(--surface-3)" : accent + "22",
          color: accent,
          flexShrink: 0,
        }}
      >
        <Icon size={15} />
      </span>
      <div style={{ flex: 1, minWidth: 0, paddingRight: "20px" }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: isUnread ? 700 : 600,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {notification.title}
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
          {notification.body}
        </p>
        {dueLabel && (
          <p style={{ fontSize: "11px", fontWeight: 600, color: accent, marginTop: "5px" }}>
            {dueLabel}
          </p>
        )}
      </div>
      <button
        type="button"
        className="notification-dismiss"
        title="Dismiss"
        aria-label={`Dismiss ${notification.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onDismiss(notification);
        }}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "22px",
          height: "22px",
          borderRadius: "6px",
          border: "none",
          background: "transparent",
          color: "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}
