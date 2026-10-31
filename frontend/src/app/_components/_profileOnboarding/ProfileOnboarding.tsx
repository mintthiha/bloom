import type { Profile } from "@/lib/api";
import { ProfileFormPanel } from "@/components/profile-form-panel";

/** First-run screen shown until the user saves a profile; replaces the dashboard entirely. */
export function ProfileOnboarding({ onSaved }: { onSaved: (profile: Profile) => void }) {
  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>
      <div className="fade-up" style={{ marginBottom: "24px" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--brand-accent-light)",
            marginBottom: "10px",
          }}
        >
          Welcome To Bloom
        </p>
        <h1
          style={{
            fontSize: "34px",
            fontWeight: 800,
            letterSpacing: "-0.6px",
            marginBottom: "8px",
          }}
        >
          Let&apos;s set up your account.
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "15px",
            maxWidth: "560px",
          }}
        >
          We need a few profile details before you start using Bloom. Your first and last name are
          prefilled from Google when available.
        </p>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        <div
          className="fade-up fade-up-1"
          style={{
            background: "var(--surface-1)",
            border: "1px solid color-mix(in srgb, var(--brand-accent) 13%, transparent)",
            borderRadius: "16px",
            padding: "24px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--brand-accent-light)",
              marginBottom: "12px",
            }}
          >
            Step 1
          </p>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "-0.4px",
              marginBottom: "8px",
            }}
          >
            Choose how your profile appears in Bloom
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "14px",
              maxWidth: "520px",
            }}
          >
            Set your name, username, and email. Once this is saved, the dashboard and sidebar will
            use your Bloom profile instead of the raw Google session name.
          </p>
        </div>

        <ProfileFormPanel
          title="Create your profile"
          description="This is the first step of onboarding. You can update these details later from the profile page."
          submitLabel="Continue to Bloom"
          successMessage="Profile saved. Loading your dashboard..."
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}
