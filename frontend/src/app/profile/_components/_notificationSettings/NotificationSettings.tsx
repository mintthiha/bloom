"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, NotificationPreferences } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ToggleRow } from "@/components/ToggleRow";
import { LeadDaySelector } from "./LeadDaySelector";
import { MilestoneSelector } from "./MilestoneSelector";
import { LowBalanceThresholdInput } from "./LowBalanceThresholdInput";
import { describeEnabledAlerts } from "./notification-preferences";

/** Shown until the saved preferences arrive, so the card never renders empty. */
const FALLBACK_PREFERENCES: NotificationPreferences = {
  billRemindersEnabled: true,
  billReminderLeadDays: 3,
  budgetOverspendAlertsEnabled: true,
  lowBalanceAlertsEnabled: true,
  lowBalanceThreshold: 100,
  goalMilestoneAlertsEnabled: true,
  goalMilestonePercentages: [50, 75, 100],
  subscriptionPriceAlertsEnabled: true,
};

/**
 * Profile-page card for every in-app notification Bloom can raise: bill
 * reminders, budget overspend, low balance, savings-goal milestones and
 * subscription price rises. Owns all preference state so each control can stay
 * presentational and one save path handles rollback.
 */
export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(FALLBACK_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /** Loads the saved notification preferences on mount. */
  useEffect(() => {
    let cancelled = false;
    async function loadPreferences() {
      try {
        const profile = await api.getProfile();
        if (!cancelled && profile) {
          setPreferences({
            billRemindersEnabled: profile.billRemindersEnabled,
            billReminderLeadDays: profile.billReminderLeadDays,
            budgetOverspendAlertsEnabled: profile.budgetOverspendAlertsEnabled,
            lowBalanceAlertsEnabled: profile.lowBalanceAlertsEnabled,
            lowBalanceThreshold: profile.lowBalanceThreshold,
            goalMilestoneAlertsEnabled: profile.goalMilestoneAlertsEnabled,
            goalMilestonePercentages: profile.goalMilestonePercentages,
            subscriptionPriceAlertsEnabled: profile.subscriptionPriceAlertsEnabled,
          });
        }
      } catch {
        // Falls back to defaults if the profile can't be loaded.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Applies a change optimistically and restores the previous value if the save fails. */
  async function savePreferences(patch: Partial<NotificationPreferences>) {
    const previousPreferences = preferences;
    setPreferences({ ...previousPreferences, ...patch });
    setIsSaving(true);
    try {
      await api.updateReminderPreferences(patch);
      toast.success("Notification settings saved");
    } catch {
      toast.error("Couldn't save notification settings");
      setPreferences(previousPreferences);
    } finally {
      setIsSaving(false);
    }
  }

  const isBusy = isSaving || isLoading;

  return (
    <CollapsibleCard
      className="fade-up"
      eyebrow="Notifications"
      title="Choose what Bloom tells you about"
      description={`Alerts appear in your notification bell. ${describeEnabledAlerts(preferences)}.`}
      style={{ marginTop: "20px", opacity: isLoading ? 0.6 : 1 }}
    >
      <div style={{ display: "grid", gap: "16px" }}>
        <ToggleRow
          label="Bill reminders"
          description="A heads-up before recurring payments are due."
          isEnabled={preferences.billRemindersEnabled}
          isDisabled={isBusy}
          showDivider={false}
          onToggle={(next) => savePreferences({ billRemindersEnabled: next })}
        >
          <LeadDaySelector
            leadDays={preferences.billReminderLeadDays}
            isDisabled={isBusy || !preferences.billRemindersEnabled}
            onChange={(days) => savePreferences({ billReminderLeadDays: days })}
          />
        </ToggleRow>

        <ToggleRow
          label="Budget overspend"
          description="When a category goes over its monthly limit."
          isEnabled={preferences.budgetOverspendAlertsEnabled}
          isDisabled={isBusy}
          onToggle={(next) => savePreferences({ budgetOverspendAlertsEnabled: next })}
        />

        <ToggleRow
          label="Low balance"
          description="When a cash account runs low."
          isEnabled={preferences.lowBalanceAlertsEnabled}
          isDisabled={isBusy}
          onToggle={(next) => savePreferences({ lowBalanceAlertsEnabled: next })}
        >
          <LowBalanceThresholdInput
            threshold={preferences.lowBalanceThreshold}
            isDisabled={isBusy || !preferences.lowBalanceAlertsEnabled}
            onCommit={(threshold) => savePreferences({ lowBalanceThreshold: threshold })}
          />
        </ToggleRow>

        <ToggleRow
          label="Savings goal milestones"
          description="Progress updates as a goal fills up."
          isEnabled={preferences.goalMilestoneAlertsEnabled}
          isDisabled={isBusy}
          onToggle={(next) => savePreferences({ goalMilestoneAlertsEnabled: next })}
        >
          <MilestoneSelector
            milestonePercentages={preferences.goalMilestonePercentages}
            isDisabled={isBusy || !preferences.goalMilestoneAlertsEnabled}
            onChange={(percentages) => savePreferences({ goalMilestonePercentages: percentages })}
          />
        </ToggleRow>

        <ToggleRow
          label="Subscription price rises"
          description="When a detected subscription costs more than before."
          isEnabled={preferences.subscriptionPriceAlertsEnabled}
          isDisabled={isBusy}
          onToggle={(next) => savePreferences({ subscriptionPriceAlertsEnabled: next })}
        />
      </div>
    </CollapsibleCard>
  );
}
