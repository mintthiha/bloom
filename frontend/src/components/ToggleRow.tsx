"use client";

/**
 * One labelled on/off row for a settings card. Fully controlled: the parent owns the value so it
 * can save (and roll back on failure) in one place.
 */
export function ToggleRow({
  label,
  description,
  isEnabled,
  isDisabled,
  onToggle,
  showDivider = true,
  children,
}: {
  label: string;
  description: string;
  isEnabled: boolean;
  isDisabled: boolean;
  onToggle: (next: boolean) => void;
  showDivider?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        paddingTop: showDivider ? "16px" : 0,
        borderTop: showDivider ? "1px solid var(--border)" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div>
          <p style={{ fontSize: "14px", fontWeight: 600 }}>{label}</p>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {description}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label={label}
          className="press"
          disabled={isDisabled}
          onClick={() => onToggle(!isEnabled)}
          style={{
            position: "relative",
            width: "44px",
            height: "24px",
            borderRadius: "999px",
            border: "none",
            background: isEnabled ? "var(--brand-accent)" : "var(--surface-3)",
            cursor: isDisabled ? "default" : "pointer",
            flexShrink: 0,
            transition: "background 0.15s ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "3px",
              left: isEnabled ? "23px" : "3px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </button>
      </div>
      {children ? (
        <div style={{ marginTop: "14px", opacity: isEnabled ? 1 : 0.5 }}>{children}</div>
      ) : null}
    </div>
  );
}
