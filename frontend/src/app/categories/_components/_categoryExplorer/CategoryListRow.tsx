"use client";
import { Pencil, Trash2, X, Check } from "lucide-react";
import type { Category } from "@/lib/api";
import { inputStyle as baseInputStyle } from "@/lib/styles/input";
import { CategoryColorPicker } from "./CategoryColorPicker";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { CATEGORY_TYPE_META } from "./category-explorer";

type CategoryListRowProps = {
  category: Category;
  isEditing: boolean;
  editName: string;
  editColor: string;
  editIcon: string;
  isSavingEdit: boolean;
  onEditNameChange: (name: string) => void;
  onEditColorChange: (color: string) => void;
  onEditIconChange: (icon: string) => void;
  onStartEdit: (category: Category) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onRequestDelete: (category: Category) => void;
};

/** One category in the unified list: a read-only row with a type tag, or an inline edit form when active. */
export function CategoryListRow({
  category,
  isEditing,
  editName,
  editColor,
  editIcon,
  isSavingEdit,
  onEditNameChange,
  onEditColorChange,
  onEditIconChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
}: CategoryListRowProps) {
  const typeMeta = CATEGORY_TYPE_META[category.type];

  if (isEditing) {
    return (
      <li
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "12px",
          borderRadius: "10px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <input
          type="text"
          aria-label="Category name"
          value={editName}
          onChange={(event) => onEditNameChange(event.target.value)}
          style={baseInputStyle}
        />
        <CategoryColorPicker value={editColor} onChange={onEditColorChange} />
        <CategoryIconPicker value={editIcon} onChange={onEditIconChange} />
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="press"
            aria-label="Cancel edit"
            onClick={onCancelEdit}
            disabled={isSavingEdit}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--surface-1)",
              color: "var(--text-secondary)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <X size={14} /> Cancel
          </button>
          <button
            type="button"
            className="press"
            aria-label="Save category"
            onClick={onSaveEdit}
            disabled={isSavingEdit}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "none",
              background: "var(--brand-accent)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: isSavingEdit ? "default" : "pointer",
              opacity: isSavingEdit ? 0.7 : 1,
            }}
          >
            <Check size={14} /> Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 10px",
        borderRadius: "10px",
      }}
    >
      <span
        aria-hidden
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${category.color}22`,
          border: `1px solid ${category.color}55`,
          fontSize: "14px",
          flexShrink: 0,
        }}
      >
        {category.icon ?? ""}
      </span>
      <span style={{ flex: 1, fontSize: "14px", fontWeight: 500, minWidth: 0 }}>
        {category.name}
      </span>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          padding: "3px 7px",
          borderRadius: "999px",
          color: typeMeta.color,
          background: `${typeMeta.color}1a`,
          border: `1px solid ${typeMeta.color}55`,
          flexShrink: 0,
        }}
      >
        {typeMeta.label}
      </span>
      <button
        type="button"
        className="rule-edit-button"
        aria-label={`Edit ${category.name}`}
        onClick={() => onStartEdit(category)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "28px",
          height: "28px",
          cursor: "pointer",
        }}
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        className="budget-delete-button"
        aria-label={`Delete ${category.name}`}
        onClick={() => onRequestDelete(category)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "28px",
          height: "28px",
          cursor: "pointer",
        }}
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}
