import type { ReactNode } from "react";

type ReviewSectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * The card each review step sits in. A step is always fully open (it's the only thing on screen),
 * so this is a static shell rather than the dashboard's collapsible card.
 */
export function ReviewSection({ eyebrow, title, description, children }: ReviewSectionProps) {
  return (
    <section
      aria-label={title}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--brand-accent-text)",
          }}
        >
          {eyebrow}
        </p>
        <h2 style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.2px" }}>{title}</h2>
        {description && (
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

type StatTileProps = { label: string; value: string; detail?: string | null };

/** A single headline number inside a review step (e.g. "Money in"). */
export function StatTile({ label, value, detail }: StatTileProps) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "14px 16px",
        minWidth: 0,
      }}
    >
      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>
        {label}
      </p>
      <p className="num" style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em" }}>
        {value}
      </p>
      {detail && (
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{detail}</p>
      )}
    </div>
  );
}

/** Grid that lays stat tiles out in as many columns as fit, collapsing to one on phones. */
export const STAT_TILE_GRID_STYLE = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
  gap: "12px",
} as const;
