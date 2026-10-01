"use client";

import { toast } from "sonner";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ToggleRow } from "@/components/ToggleRow";
import { useDisplayPreferences } from "@/components/display-preferences-provider";

/**
 * Profile-page card for the money display preferences (hide cents, privacy mode). Both persist to
 * this browser immediately and survive reloads and re-logins, so toggling here shows a confirming
 * toast rather than a loading/saving state.
 */
export function DisplayPreferencesCard() {
  const { hideCents, toggleHideCents, privacyMode, togglePrivacyMode } = useDisplayPreferences();

  return (
    <CollapsibleCard
      className="fade-up"
      eyebrow="Display"
      title="How Bloom shows your money"
      description="Saved to this browser, so these stick around after you reload or sign back in."
      style={{ marginTop: "20px" }}
    >
      <div style={{ display: "grid", gap: "16px" }}>
        <ToggleRow
          label="Hide cents"
          description="Round balances to whole dollars, e.g. $1,235 instead of $1,234.56."
          isEnabled={hideCents}
          isDisabled={false}
          showDivider={false}
          onToggle={() => {
            toggleHideCents();
            toast.success(hideCents ? "Now showing cents" : "Now hiding cents");
          }}
        />
        <ToggleRow
          label="Privacy mode"
          description="Blur balances across the app until you hover over them."
          isEnabled={privacyMode}
          isDisabled={false}
          onToggle={() => {
            togglePrivacyMode();
            toast.success(privacyMode ? "Privacy mode off" : "Privacy mode on");
          }}
        />
      </div>
    </CollapsibleCard>
  );
}
