"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api, Profile } from "@/lib/api";

type ProfileFormPanelProps = {
  title: string;
  description: string;
  submitLabel: string;
  successMessage?: string;
  onSaved?: (profile: Profile) => void;
};

/**
 * Splits the Google display name into first and last name defaults so the
 * profile form can be prefilled before the user has saved Prisma data.
 */
function getSessionNameParts(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function ProfileFormPanel({
  title,
  description,
  submitLabel,
  successMessage = "Profile saved",
  onSaved,
}: ProfileFormPanelProps) {
  const { data: session, status } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * Loads the saved profile when it exists and otherwise prefills the form
   * from the authenticated Google session.
   */
  useEffect(() => {
    if (status === "loading") {
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const profile = await api.getProfile();
        if (cancelled) {
          return;
        }

        const sessionName = getSessionNameParts(session?.user?.name);
        setFirstName(profile?.firstName ?? sessionName.firstName);
        setLastName(profile?.lastName ?? sessionName.lastName);
        setUsername(profile?.username ?? "");
        setEmail(profile?.email ?? session?.user?.email ?? "");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, session?.user?.name, status]);

  /**
   * Persists the profile fields and returns the normalized saved values to the
   * caller so parent screens can react immediately.
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const profile = await api.saveProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
      });
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setUsername(profile.username);
      setEmail(profile.email);
      setSuccess(successMessage);
      onSaved?.(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "14px",
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div
      className="fade-up fade-up-1"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.4px", marginBottom: "6px" }}>
          {title}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          {description}
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="skeleton" style={{ height: "44px" }} />
          <div className="skeleton" style={{ height: "44px" }} />
          <div className="skeleton" style={{ height: "44px" }} />
          <div className="skeleton" style={{ height: "44px" }} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Your last name"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="unique_username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
            />
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
              Lowercase letters, numbers, and underscores only.
            </p>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>

          {error && (
            <p className="num" style={{ color: "#f87171", fontSize: "12px" }}>
              {error}
            </p>
          )}

          {success && (
            <p className="num" style={{ color: "#22c55e", fontSize: "12px" }}>
              {success}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "12px 20px",
                background: "#f59e0b",
                color: "#000",
                fontWeight: 700,
                fontSize: "14px",
                border: "none",
                borderRadius: "10px",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.45 : 1,
              }}
            >
              {saving ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
