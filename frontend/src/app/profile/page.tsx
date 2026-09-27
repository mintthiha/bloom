"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api, Profile } from "@/lib/api";
import { ProfileFormPanel } from "@/components/profile-form-panel";
import { ProfileIdentityHeader } from "./_components/_profileHeader/ProfileIdentityHeader";
import { GlanceStatsStrip } from "./_components/_glanceStats/GlanceStatsStrip";
import { FinancialProfilePanel } from "./_components/_financialProfile/FinancialProfilePanel";
import { ReminderSettings } from "./_components/_reminderSettings/ReminderSettings";
import { AccountDataPanel } from "./_components/_accountData/AccountDataPanel";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [savedProfile, setSavedProfile] = useState<Profile | null>(null);

  /** Loads the saved profile so the identity header can show the stored name and handle. */
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await api.getProfile();
        if (!cancelled) setSavedProfile(profile);
      } catch {
        if (!cancelled) setSavedProfile(null);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px" }}>
      <ProfileIdentityHeader
        firstName={savedProfile?.firstName ?? null}
        lastName={savedProfile?.lastName ?? null}
        username={savedProfile?.username ?? null}
        email={savedProfile?.email ?? session?.user?.email ?? null}
        avatarColor={savedProfile?.avatarColor ?? null}
        imageUrl={session?.user?.image ?? null}
      />
      <GlanceStatsStrip createdAt={savedProfile?.createdAt ?? null} />
      <ProfileFormPanel
        collapsible
        eyebrow="Profile Details"
        title="Who you are"
        description="Your name, username, email, and the tax details Bloom uses for contribution room."
        submitLabel="Save profile"
        onSaved={setSavedProfile}
      />
      <FinancialProfilePanel />
      <ReminderSettings />
      <AccountDataPanel email={savedProfile?.email ?? session?.user?.email ?? null} />
    </div>
  );
}
