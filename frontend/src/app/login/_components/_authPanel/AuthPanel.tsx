"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { BloomMark } from "@/components/BloomMark";
import { EmailSignInForm } from "./EmailSignInForm";
import { GoogleMark } from "./GoogleMark";
import { SavedAccountCard } from "./SavedAccountCard";
import { useLoginActions } from "./useLoginActions";

/** The theme-aware sign-in column: Google, the demo, a saved account, and email + password. */
export function AuthPanel() {
  const loginActions = useLoginActions();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        {/* Logo shown here only when the showcase panel is hidden (small screens). */}
        <div
          className="lg:hidden fade-up"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "28px",
            animationDelay: "0.05s",
          }}
        >
          <BloomMark size={30} />
          <span style={{ fontWeight: 800, fontSize: "22px", letterSpacing: "-0.4px" }}>Bloom</span>
        </div>

        <h2
          className="fade-up"
          style={{
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.4px",
            marginBottom: "6px",
            animationDelay: "0.12s",
          }}
        >
          Welcome back
        </h2>
        <p
          className="fade-up"
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            marginBottom: "28px",
            animationDelay: "0.19s",
          }}
        >
          Sign in to access your accounts.
        </p>

        <div className="fade-up" style={{ animationDelay: "0.26s" }}>
          <button
            type="button"
            className="login-google-button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "12px 20px",
              background: "#fff",
              color: "#000",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <GoogleMark />
            Continue with Google
          </button>
        </div>

        <p
          className="fade-up"
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginTop: "12px",
            lineHeight: 1.5,
            animationDelay: "0.33s",
          }}
        >
          Secure sign-in with Google. New here? Signing in creates your account automatically.
        </p>

        <div className="fade-up" style={{ marginTop: "12px", animationDelay: "0.3s" }}>
          <button
            type="button"
            disabled={loginActions.isTryingDemo}
            onClick={loginActions.handleTryDemo}
            className="press"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 20px",
              background: "color-mix(in srgb, var(--brand-accent) 10%, transparent)",
              color: "var(--brand-accent-light)",
              border: "1px solid color-mix(in srgb, var(--brand-accent) 25%, transparent)",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loginActions.isTryingDemo ? "not-allowed" : "pointer",
              opacity: loginActions.isTryingDemo ? 0.7 : 1,
            }}
          >
            {loginActions.isTryingDemo ? "Preparing your demo…" : "Try Bloom without signing in"}
          </button>
        </div>
        <p
          className="fade-up"
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginTop: "8px",
            lineHeight: 1.5,
            animationDelay: "0.35s",
          }}
        >
          Explore a sample account with six months of transactions, no sign-up required.
        </p>
        {loginActions.demoError && (
          <p
            role="alert"
            className="fade-up"
            style={{
              fontSize: "13px",
              color: "var(--negative-soft)",
              padding: "8px 12px",
              marginTop: "8px",
              background: "#f8717110",
              border: "1px solid #f8717130",
              borderRadius: "8px",
            }}
          >
            {loginActions.demoError}
          </p>
        )}

        {loginActions.savedAccount && (
          <SavedAccountCard
            savedAccount={loginActions.savedAccount}
            isSigningIn={loginActions.isSavedSigningIn}
            onSignIn={loginActions.handleSavedSignIn}
            onForget={loginActions.handleForgetSavedAccount}
          />
        )}

        {/* Divider */}
        <div
          className="fade-up"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            margin: "20px 0",
            animationDelay: "0.38s",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        </div>

        <EmailSignInForm
          email={loginActions.credentialEmail}
          password={loginActions.credentialPassword}
          rememberMe={loginActions.rememberMe}
          error={loginActions.credentialError}
          isSubmitting={loginActions.isCredentialSubmitting}
          onEmailChange={loginActions.setCredentialEmail}
          onPasswordChange={loginActions.setCredentialPassword}
          onRememberMeChange={loginActions.setRememberMe}
          onSubmit={loginActions.handleCredentialSignIn}
        />

        <p
          className="fade-up"
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            marginTop: "16px",
            textAlign: "center",
            animationDelay: "0.48s",
          }}
        >
          No account?{" "}
          <Link
            href="/register"
            style={{
              color: "var(--brand-accent-light)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
