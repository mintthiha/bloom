import type { SavedAccount } from "@/lib/saved-account";

interface SavedAccountCardProps {
  /** The account remembered on this browser. */
  savedAccount: SavedAccount;
  /** Whether the one-click sign-in is in flight. */
  isSigningIn: boolean;
  /** Signs in with the saved sign-in cookie. */
  onSignIn: () => void;
  /** Forgets the saved account ("Not you?"). */
  onForget: () => void;
}

/** "Continue as …" one-click sign-in for the account remembered on this browser. */
export function SavedAccountCard({
  savedAccount,
  isSigningIn,
  onSignIn,
  onForget,
}: SavedAccountCardProps) {
  return (
    <div className="fade-up" style={{ marginTop: "16px", animationDelay: "0.33s" }}>
      <button
        type="button"
        disabled={isSigningIn}
        onClick={onSignIn}
        className="press"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "12px 14px",
          background: "var(--surface-1, var(--surface-0))",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: isSigningIn ? "not-allowed" : "pointer",
          opacity: isSigningIn ? 0.7 : 1,
          color: "inherit",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--brand-accent) 13%, transparent)",
              border: "1px solid color-mix(in srgb, var(--brand-accent) 25%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--brand-accent-text)",
              flexShrink: 0,
            }}
          >
            {savedAccount.email[0].toUpperCase()}
          </span>
          <span>
            <span style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>Continue as</span>
            <span
              style={{
                display: "block",
                fontSize: "12px",
                color: "var(--text-secondary)",
                fontWeight: 400,
              }}
            >
              {savedAccount.email}
            </span>
          </span>
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: "18px", lineHeight: 1 }}>→</span>
      </button>
      <button
        type="button"
        onClick={onForget}
        style={{
          background: "none",
          border: "none",
          padding: "6px 2px",
          fontSize: "12px",
          color: "var(--text-muted)",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        }}
      >
        Not you?
      </button>
    </div>
  );
}
