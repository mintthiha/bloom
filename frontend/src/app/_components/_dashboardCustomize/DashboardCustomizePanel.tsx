"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ALL_CARD_IDS,
  CARD_METADATA,
  CardId,
  useDashboardVisibility,
} from "@/components/dashboard-visibility-provider";

/** Animated pill switch indicating whether a card is visible. */
function CardToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "999px",
        background: checked ? "#f59e0b" : "var(--surface-2)",
        border: `1px solid ${checked ? "#f59e0b" : "var(--border)"}`,
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s, border-color 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: checked ? "18px" : "2px",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          background: checked ? "#fff" : "var(--text-muted)",
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

/** One row inside the panel showing the card label, description, and its visibility toggle. */
function CardToggleRow({ cardId }: { cardId: CardId }) {
  const { visibleCards, toggleCard } = useDashboardVisibility();
  const meta = CARD_METADATA[cardId];
  const isVisible = visibleCards.has(cardId);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
        gap: "12px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>
          {meta.label}
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          {meta.description}
        </p>
      </div>
      <CardToggle checked={isVisible} onChange={() => toggleCard(cardId)} />
    </div>
  );
}

/** Right-side drawer for toggling which dashboard cards are shown or hidden. */
export function DashboardCustomizePanel() {
  const { resetToDefaults, visibleCards } = useDashboardVisibility();
  const hiddenCount = ALL_CARD_IDS.length - visibleCards.size;

  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          />
        }
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
        Customize
        {hiddenCount > 0 && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "999px",
              background: "#f59e0b22",
              color: "#f59e0b",
              border: "1px solid #f59e0b44",
            }}
          >
            {hiddenCount} hidden
          </span>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        style={{ overflowY: "auto", background: "var(--sidebar)", borderLeft: "1px solid var(--border)" }}
      >
        <SheetHeader style={{ padding: "28px 24px 16px" }}>
          <SheetTitle style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.4px" }}>
            Customize Dashboard
          </SheetTitle>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Choose which cards appear on your dashboard.
          </p>
        </SheetHeader>

        <div style={{ padding: "0 24px" }}>
          {ALL_CARD_IDS.map((cardId) => (
            <CardToggleRow key={cardId} cardId={cardId} />
          ))}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={resetToDefaults}
              style={{
                marginTop: "24px",
                width: "100%",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "8px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            >
              Reset to defaults
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
