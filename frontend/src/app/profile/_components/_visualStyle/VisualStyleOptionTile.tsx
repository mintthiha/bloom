"use client";

import type { VisualStyle } from "@/lib/visual-style";

/**
 * One selectable look in the Appearance card: a small preview swatch, a name, and a one-line
 * description. Rendered as a radio so the pair reads as a single either/or choice to assistive
 * tech. Controlled — the card owns which look is selected.
 */
export function VisualStyleOptionTile({
  visualStyle,
  label,
  description,
  isSelected,
  onSelect,
}: {
  visualStyle: VisualStyle;
  label: string;
  description: string;
  isSelected: boolean;
  onSelect: (visualStyle: VisualStyle) => void;
}) {
  const isExtravagant = visualStyle === "extravagant";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      className="visual-style-tile"
      onClick={() => onSelect(visualStyle)}
      style={{
        display: "grid",
        gap: "12px",
        padding: "12px",
        textAlign: "left",
        background: "var(--surface-1)",
        borderRadius: "12px",
        color: "var(--text-primary)",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden
        className={isExtravagant ? "visual-style-preview-extravagant" : undefined}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "6px",
          height: "76px",
          padding: "10px",
          borderRadius: "8px",
          border: isExtravagant ? "none" : "1px solid var(--border)",
          ...(isExtravagant ? {} : { background: "var(--surface-2)" }),
        }}
      >
        {[34, 52, 26].map((barHeight, barIndex) => (
          <span
            key={barIndex}
            style={{
              flex: 1,
              height: `${barHeight}px`,
              borderRadius: "5px",
              background: isExtravagant ? "rgba(255, 255, 255, 0.82)" : "var(--surface-4)",
            }}
          />
        ))}
      </span>
      <span style={{ display: "grid", gap: "2px" }}>
        <span style={{ fontSize: "14px", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{description}</span>
      </span>
    </button>
  );
}
