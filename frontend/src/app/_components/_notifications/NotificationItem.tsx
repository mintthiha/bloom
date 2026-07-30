"use client";
import { X } from "lucide-react";
import { AppNotification } from "@/lib/api";
import { classifyReminderUrgency, formatDueLabel, ReminderUrgency } from "./notification-utils";

type Props = {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onDismiss: (notification: AppNotification) => void;
};

const URGENCY_COLOR: Record<ReminderUrgency, string> = {
  overdue: "#f87171",
  "due-soon": "#3b82f6",
  upcoming: "var(--text-muted)",
};

/** A single notification row: urgency dot, title/body, due label, and dismiss control. */
export function NotificationItem({ notification, onMarkRead, onDismiss }: Props) {
  const urgency = classifyReminderUrgency(notification.dueDate);
  const dotColor = URGENCY_COLOR[urgency];
  const dueLabel = formatDueLabel(notification.dueDate);
  const isUnread = notification.status === "UNREAD";

  /** Marks the notification read when the user opens/focuses the row (only if still unread). */
  function handleActivate() {
    if (isUnread) onMarkRead(notification.id);
  }

  return (
    <div
      className="notification-item"
      onMouseEnter={handleActivate}
      style={{
        position: "relative",
        background: isUnread ? "var(--surface-2)" : "transparent",
        border: `1px solid ${urgency !== "upcoming" ? dotColor + "44" : "var(--border)"}`,
        borderRadius: "10px",
        padding: "12px 14px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isUnread ? dotColor : "var(--surface-3)",
          marginTop: "5px",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, paddingRight: "20px" }}>
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
              fontWeight: isUnread ? 700 : 600,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {notification.title}
          </p>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
          {notification.body}
        </p>
        {dueLabel && (
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: dotColor,
              marginTop: "5px",
            }}
          >
            {dueLabel}
          </p>
        )}
      </div>
      <button
        type="button"
        className="notification-dismiss"
        title="Dismiss"
        aria-label={`Dismiss ${notification.title}`}
        onClick={() => onDismiss(notification)}
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
