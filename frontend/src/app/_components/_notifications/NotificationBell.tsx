"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { groupNotifications } from "./notification-utils";

/** How often the badge silently refreshes while the app is open. */
const POLL_INTERVAL_MS = 60_000;

/** Bell button with unread badge that opens a side panel of bill reminders. */
export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  /**
   * Keeps the badge live: loads on mount, polls on an interval, refreshes when
   * the tab regains focus, and reacts to recurring-rule changes.
   */
  useEffect(() => {
    loadNotifications();

    const interval = setInterval(loadNotifications, POLL_INTERVAL_MS);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") loadNotifications();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("recurring-changed", loadNotifications);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("recurring-changed", loadNotifications);
    };
  }, [loadNotifications]);

  /** Refreshes reminders whenever the panel is opened so newly-due items appear immediately. */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) loadNotifications();
  }

  /** Marks a notification read, then navigates to its linked page and closes the panel. */
  function handleActivateLink(notification: AppNotification) {
    if (notification.status === "UNREAD") handleMarkRead(notification.id);
    if (notification.linkHref) {
      setOpen(false);
      router.push(notification.linkHref);
    }
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
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-secondary)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Bell size={15} />
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
          side="right"
          style={{
            width: "min(65vw, 22rem)",
            overflowY: "auto",
            background: "var(--sidebar)",
            borderLeft: "1px solid var(--border)",
          }}
        >
          <SheetHeader style={{ padding: "28px 24px 16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginRight: "28px",
              }}
            >
              <SheetTitle style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.4px" }}>
                Notifications
              </SheetTitle>
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
                    whiteSpace: "nowrap",
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <SheetDescription
              style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}
            >
              Bill reminders and account alerts.
            </SheetDescription>
          </SheetHeader>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              padding: "0 24px 24px",
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
                  Reminders and alerts appear here as they come up.
                </p>
              </div>
            ) : (
              groupNotifications(notifications).map((group) => (
                <div
                  key={group.label}
                  style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                >
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--text-muted)",
                    }}
                  >
                    {group.label}
                  </p>
                  {group.items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onActivate={handleActivateLink}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
