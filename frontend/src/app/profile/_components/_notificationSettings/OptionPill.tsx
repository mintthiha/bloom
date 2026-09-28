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
        border: `1px solid ${isSelected ? "#3b82f666" : "var(--border)"}`,
        background: isSelected ? "#3b82f61a" : "var(--surface-2)",
        color: isSelected ? "#3b82f6" : "var(--text-secondary)",
        fontSize: "13px",
        fontWeight: 600,
        cursor: isDisabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}
