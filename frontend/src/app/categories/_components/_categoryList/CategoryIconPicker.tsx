"use client";
import { inputStyle as baseInputStyle } from "@/lib/styles/input";
import { CATEGORY_ICON_QUICK_PICKS, MAX_CATEGORY_ICON_LENGTH } from "./category-options";

/** Quick-pick emoji grid plus a free-text field for a category's icon. */
export function CategoryIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {CATEGORY_ICON_QUICK_PICKS.map((icon) => {
          const isSelected = icon === value;
          return (
            <button
              key={icon}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Use ${icon} icon`}
              className="press"
              onClick={() => onChange(icon)}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                background: isSelected ? "var(--surface-3)" : "var(--surface-2)",
                border: `1px solid ${isSelected ? "var(--text-secondary)" : "var(--border)"}`,
                cursor: "pointer",
              }}
            >
              {icon}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        aria-label="Category icon"
        value={value}
        maxLength={MAX_CATEGORY_ICON_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Or type any emoji"
        style={{ ...baseInputStyle, maxWidth: "160px" }}
      />
    </div>
  );
}
