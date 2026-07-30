"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { api, AppNotification } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NotificationItem } from "./NotificationItem";

/** Bell button with unread badge that opens a side panel of bill reminders. */
export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  /** Fetches the latest notifications (which regenerates due reminders server-side). */
  const loadNotifications = useCallback(async () => {
    try {
      const result = await api.listNotifications();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      // Non-critical — the bell simply stays empty on error.
    } finally {
      setLoading(false);
    }
  }, []);

  /** Loads on mount and whenever recurring rules change (which can create new reminders). */
  useEffect(() => {
    loadNotifications();
    window.addEventListener("recurring-changed", loadNotifications);
    return () => window.removeEventListener("recurring-changed", loadNotifications);
  }, [loadNotifications]);

  /** Refreshes reminders whenever the panel is opened so newly-due bills appear immediately. */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) loadNotifications();
  }

  /** Marks one notification read, updating the badge optimistically. */
  async function handleMarkRead(id: string) {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, status: "READ" as const } : item))
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await api.markNotificationRead(id);
    } catch {
      loadNotifications();
    }
  }

  /** Marks every notification read and confirms with a toast. */
  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setNotifications((current) => current.map((item) => ({ ...item, status: "READ" as const })));
    setUnreadCount(0);
    try {
      await api.markAllNotificationsRead();
      toast.success("All reminders marked read");
    } catch {
      toast.error("Couldn't mark reminders read");
      loadNotifications();
    }
  }

  /** Dismisses a notification so it no longer appears, confirming with a toast. */
  async function handleDismiss(notification: AppNotification) {
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    if (notification.status === "UNREAD") {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    try {
      await api.dismissNotification(notification.id);
      toast.success("Reminder dismissed");
    } catch {
      toast.error("Couldn't dismiss reminder");
      loadNotifications();
    }
  }

  const hasUnread = unreadCount > 0;

  return (
    <>
      <button
        type="button"
        className="notification-bell"
        aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : "Notifications"}
        onClick={() => handleOpenChange(true)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          background: "var(--surface-1)",
          color: "var(--text-secondary)",
          cursor: "pointer",
        }}
      >
        <Bell size={17} />
        {hasUnread && (
          <span
            className="num"
            style={{
              position: "absolute",
              top: "-6px",
              right: "-6px",
              minWidth: "18px",
              height: "18px",
              padding: "0 5px",
              borderRadius: "999px",
              background: "#ef4444",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--background)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          style={{
            width: "min(420px, 100vw)",
            maxWidth: "100vw",
            background: "var(--surface-1)",
            color: "var(--text-primary)",
            borderLeft: "1px solid var(--border)",
            boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.35)",
          }}
        >
          <SheetHeader>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <SheetTitle>Notifications</SheetTitle>
              {hasUnread && (
                <button
                  type="button"
                  className="press"
                  onClick={handleMarkAllRead}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#3b82f6",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "2px 4px",
                    marginRight: "28px",
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <SheetDescription>Upcoming and overdue bill reminders.</SheetDescription>
          </SheetHeader>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "0 16px 16px",
              overflowY: "auto",
            }}
          >
            {loading ? (
              <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading…</p>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  padding: "32px 12px",
                }}
              >
                <Bell size={22} style={{ opacity: 0.5, marginBottom: "8px" }} />
                <p>You&apos;re all caught up.</p>
                <p style={{ fontSize: "12px", marginTop: "4px" }}>
                  Bill reminders appear here as due dates approach.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onDismiss={handleDismiss}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
