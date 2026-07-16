"use client";

/** Floating "how it works" hint shown over a card the first time the user enables it. */
export function CardExplainerCallout({
  label,
  howItWorks,
  onDismiss,
}: {
  label: string;
  howItWorks: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fade-up"
      style={{
        position: "absolute",
        top: "12px",
        left: "12px",
        right: "12px",
        zIndex: 5,
        background: "var(--surface-1)",
        border: "1px solid #f59e0b",
        borderRadius: "12px",
        padding: "14px 16px",
        boxShadow: "0 12px 32px -12px rgba(0, 0, 0, 0.55)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "999px",
            background: "#f59e0b",
            flexShrink: 0,
          }}
        />
        <p style={{ fontSize: "13px", fontWeight: 700 }}>{label}</p>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#f59e0b",
          }}
        >
          New card
        </span>
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {howItWorks}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
        <button
          type="button"
          className="press"
          onClick={onDismiss}
          style={{
            padding: "6px 14px",
            background: "#f59e0b",
            color: "#000",
            fontWeight: 700,
            fontSize: "12px",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
