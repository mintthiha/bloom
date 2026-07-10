import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

interface EmptyStateProps {
  /** Icon shown in the soft circular badge above the title. */
  icon: LucideIcon;
  /** Short headline describing what is empty (e.g. "No transactions yet"). */
  title: string;
  /** Optional supporting line explaining how the section gets populated. */
  description?: string;
  /** Optional call-to-action, typically a button, rendered below the text. */
  action?: ReactNode;
  /**
   * "panel" renders a full dashed-border container for standalone empty areas;
   * "inline" is compact and borderless for use inside an existing card.
   */
  variant?: "panel" | "inline";
  className?: string;
  style?: CSSProperties;
}

/** Standard empty-state placeholder: a soft icon badge, title, optional description, and optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "panel",
  className,
  style,
}: EmptyStateProps) {
  const isPanel = variant === "panel";

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "6px",
        padding: isPanel ? "48px 24px" : "28px 16px",
        border: isPanel ? "1px dashed var(--border)" : "none",
        borderRadius: "14px",
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "44px",
          height: "44px",
          borderRadius: "999px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
          marginBottom: "4px",
        }}
      >
        <Icon size={20} strokeWidth={1.75} />
      </div>

      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>{title}</p>

      {description && (
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            maxWidth: "280px",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}

      {action && <div style={{ marginTop: "10px" }}>{action}</div>}
    </div>
  );
}
