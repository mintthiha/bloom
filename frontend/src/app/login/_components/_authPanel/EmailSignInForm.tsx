import type { CSSProperties, FormEvent } from "react";

interface EmailSignInFormProps {
  email: string;
  password: string;
  /** Whether "Remember me for 30 days" is ticked. */
  rememberMe: boolean;
  /** Message from the last failed sign-in (email or saved), shown above the button. */
  error: string | null;
  isSubmitting: boolean;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onRememberMeChange: (rememberMe: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--surface-1, var(--surface-0))",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "14px",
  color: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

/** Email + password sign-in form with the remember-me option. */
export function EmailSignInForm({
  email,
  password,
  rememberMe,
  error,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onRememberMeChange,
  onSubmit,
}: EmailSignInFormProps) {
  return (
    <form
      className="fade-up"
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        animationDelay: "0.43s",
      }}
    >
      <input
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        placeholder="Email"
        aria-label="Email"
        className="login-input"
        style={fieldStyle}
      />
      <input
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        placeholder="Password"
        aria-label="Password"
        className="login-input"
        style={fieldStyle}
      />
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          color: "var(--text-secondary)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => onRememberMeChange(event.target.checked)}
          style={{
            width: "14px",
            height: "14px",
            accentColor: "var(--brand-accent)",
            cursor: "pointer",
          }}
        />
        Remember me for 30 days
      </label>

      {error && (
        <p
          role="alert"
          style={{
            fontSize: "13px",
            color: "var(--negative-soft)",
            padding: "8px 12px",
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
          padding: "11px 20px",
          background: "var(--surface-0)",
          color: "inherit",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: isSubmitting ? "not-allowed" : "pointer",
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        {isSubmitting ? "Signing in…" : "Sign in with email"}
      </button>
    </form>
  );
}
