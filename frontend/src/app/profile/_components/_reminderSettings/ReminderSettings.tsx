"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const LEAD_DAY_OPTIONS = [1, 3, 5, 7];

/** Profile-page card for opting into bill reminders and choosing the lead time. */
export function ReminderSettings() {
  const [enabled, setEnabled] = useState(true);
  const [leadDays, setLeadDays] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /** Loads the saved reminder preferences on mount. */
  useEffect(() => {
    let cancelled = false;
    async function loadPreferences() {
      try {
        const profile = await api.getProfile();
        if (!cancelled && profile) {
          setEnabled(profile.billRemindersEnabled);
          setLeadDays(profile.billReminderLeadDays);
        }
      } catch {
        // Falls back to defaults if the profile can't be loaded.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persists a preference change, rolling back local state on failure. */
  async function savePreferences(
    next: { billRemindersEnabled?: boolean; billReminderLeadDays?: number },
    rollback: () => void
  ) {
    setSaving(true);
    try {
      await api.updateReminderPreferences(next);
      toast.success("Reminder settings saved");
    } catch {
      toast.error("Couldn't save reminder settings");
      rollback();
    } finally {
      setSaving(false);
    }
  }

  /** Toggles reminders on/off. */
  function handleToggle() {
    const next = !enabled;
    const previous = enabled;
    setEnabled(next);
    savePreferences({ billRemindersEnabled: next }, () => setEnabled(previous));
  }

  /** Sets how many days before a due date the reminder appears. */
  function handleLeadDays(days: number) {
    if (days === leadDays) return;
    const previous = leadDays;
    setLeadDays(days);
    savePreferences({ billReminderLeadDays: days }, () => setLeadDays(previous));
  }

  return (
    <div
      className="fade-up"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "24px",
        marginTop: "20px",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>Bill reminders</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
        Get a heads-up in your notifications before recurring payments are due.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          paddingBottom: "16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <p style={{ fontSize: "14px", fontWeight: 600 }}>Enable reminders</p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            Turn payment reminders on or off.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable bill reminders"
          className="press"
          disabled={saving || loading}
          onClick={handleToggle}
          style={{
            position: "relative",
            width: "44px",
            height: "24px",
            borderRadius: "999px",
            border: "none",
            background: enabled ? "#3b82f6" : "var(--surface-3)",
            cursor: saving || loading ? "default" : "pointer",
            flexShrink: 0,
            transition: "background 0.15s ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "3px",
              left: enabled ? "23px" : "3px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </button>
      </div>

      <div style={{ marginTop: "16px", opacity: enabled ? 1 : 0.5 }}>
        <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "3px" }}>Remind me ahead by</p>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          How many days before a due date to start reminding you.
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {LEAD_DAY_OPTIONS.map((days) => {
            const selected = days === leadDays;
            return (
              <button
                key={days}
                type="button"
                className="press"
                disabled={!enabled || saving || loading}
                onClick={() => handleLeadDays(days)}
                style={{
                  minWidth: "56px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: `1px solid ${selected ? "#3b82f666" : "var(--border)"}`,
                  background: selected ? "#3b82f61a" : "var(--surface-2)",
                  color: selected ? "#3b82f6" : "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: !enabled || saving || loading ? "default" : "pointer",
                }}
              >
                {days} {days === 1 ? "day" : "days"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
