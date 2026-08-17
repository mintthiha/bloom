"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

/** Bloom logomark; `size` controls the square badge dimension. */
function BloomMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#3b82f6" />
      <path
        d="M8 20V8h5.5a4 4 0 0 1 0 8H8"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 16h7a4 4 0 0 1 0 8H8"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Submits the registration form, then signs the user in automatically on success. */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        return;
      }

      await signIn("credentials", { email, password, callbackUrl: "/" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        overflow: "hidden",
        padding: "32px",
        background: "var(--surface-0)",
      }}
    >
      <div className="fade-up" style={{ width: "100%", maxWidth: "360px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "28px",
          }}
        >
          <BloomMark size={28} />
          <span style={{ fontWeight: 800, fontSize: "20px", letterSpacing: "-0.4px" }}>Bloom</span>
        </div>

        <h2
          style={{
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.4px",
            marginBottom: "6px",
          }}
        >
          Create your account
        </h2>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "28px" }}>
          Sign up with your email to get started.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="register-email"
              style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="login-input"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--surface-1, var(--surface-0))",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "14px",
                color: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="register-password"
              style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="login-input"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--surface-1, var(--surface-0))",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "14px",
                color: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="register-confirm-password"
              style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}
            >
              Confirm password
            </label>
            <input
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="login-input"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--surface-1, var(--surface-0))",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "14px",
                color: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p
              style={{
                fontSize: "13px",
                color: "#f87171",
                padding: "10px 12px",
                background: "#f8717110",
                border: "1px solid #f8717130",
                borderRadius: "8px",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="press"
            style={{
              width: "100%",
              padding: "12px 20px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              marginTop: "4px",
            }}
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#3b82f6", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
