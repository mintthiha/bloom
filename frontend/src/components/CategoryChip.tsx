import { CategoryAppearanceLookup, resolveCategoryAppearance } from "@/lib/category-appearance";

/**
 * `default` is the standalone pill used in table cells; `compact` matches the 10px uppercase
 * rhythm of the account history metadata row, where a full-size pill would dominate.
 */
export type CategoryChipSize = "default" | "compact";

type Props = {
  name: string | null | undefined;
  lookup: CategoryAppearanceLookup;
  size?: CategoryChipSize;
  /** Hides the emoji glyph where horizontal space is tight, keeping just the coloured pill. */
  showIcon?: boolean;
  /** Rendered in place of the chip when there is no category; a dash suits table cells. */
  emptyFallback?: React.ReactNode;
};

/**
 * Renders a category name as a pill tinted with that category's own colour, so the same
 * category reads identically across the transactions table, account history, and import
 * preview.
 */
export function CategoryChip({
  name,
  lookup,
  size = "default",
  showIcon = true,
  emptyFallback = <span style={{ color: "var(--text-muted)" }}>—</span>,
}: Props) {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return <>{emptyFallback}</>;
  }

  const { color, icon } = resolveCategoryAppearance(trimmedName, lookup);
  const isCompact = size === "compact";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isCompact ? "4px" : "5px",
        maxWidth: "100%",
        padding: isCompact ? "2px 6px" : "3px 9px",
        borderRadius: "999px",
        background: `${color}1a`,
        border: `1px solid ${color}55`,
        color: isCompact ? "var(--text-secondary)" : "var(--text-primary)",
        fontSize: isCompact ? "10px" : "12px",
        fontWeight: isCompact ? 700 : 600,
        letterSpacing: isCompact ? "0.04em" : undefined,
        textTransform: isCompact ? "uppercase" : undefined,
        lineHeight: 1.4,
        verticalAlign: "middle",
      }}
    >
      {showIcon && icon && (
        <span aria-hidden style={{ fontSize: isCompact ? "10px" : "11px", flexShrink: 0 }}>
          {icon}
        </span>
      )}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {trimmedName}
      </span>
    </span>
  );
}
