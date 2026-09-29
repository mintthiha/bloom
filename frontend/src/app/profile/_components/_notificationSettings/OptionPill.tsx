"use client";

/** Shared pill button used by the lead-day and milestone selectors. */
export function OptionPill({
  label,
  isSelected,
  isDisabled,
  onSelect,
}: {
  label: string;
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="press"
      aria-pressed={isSelected}
      disabled={isDisabled}
      onClick={onSelect}
      style={{
        minWidth: "56px",
        padding: "8px 14px",
        borderRadius: "10px",
        border: `1px solid ${isSelected ? "color-mix(in srgb, var(--brand-accent) 40%, transparent)" : "var(--border)"}`,
        background: isSelected
          ? "color-mix(in srgb, var(--brand-accent) 10%, transparent)"
          : "var(--surface-2)",
        color: isSelected ? "var(--brand-accent)" : "var(--text-secondary)",
        fontSize: "13px",
        fontWeight: 600,
        cursor: isDisabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}
