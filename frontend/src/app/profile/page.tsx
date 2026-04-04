"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

        setFullName(profile?.fullName ?? session?.user?.name ?? "");
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const profile = await api.saveProfile({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
      });
      setFullName(profile.fullName);
      setUsername(profile.username);
      setEmail(profile.email);
      setSuccess("Profile saved");
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
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px" }}>
      <div className="fade-up" style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "6px" }}>
          Profile
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          Manage the personal information stored for your Bloom account.
        </p>
      </div>

      <div className="fade-up fade-up-1" style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "24px",
      }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="skeleton" style={{ height: "18px", width: "120px" }} />
            <div className="skeleton" style={{ height: "44px" }} />
            <div className="skeleton" style={{ height: "44px" }} />
            <div className="skeleton" style={{ height: "44px" }} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                style={inputStyle}
              />
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
                {saving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
