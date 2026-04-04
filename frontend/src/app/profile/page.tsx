"use client";

import { ProfileFormPanel } from "@/components/profile-form-panel";

export default function ProfilePage() {
  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px" }}>
      <div className="fade-up" style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "6px" }}>
          Profile
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          Manage the personal information stored for your Bloom account.
        </p>
      </div>
      <ProfileFormPanel
        title="Profile Details"
        description="Update the personal information stored for your Bloom account."
        submitLabel="Save profile"
      />
    </div>
  );
}
