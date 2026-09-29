"use client";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { api, Category, CategoryType } from "@/lib/api";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { inputStyle as baseInputStyle } from "@/lib/styles/input";
import { CategoryListRow } from "./CategoryListRow";
import { CategoryColorPicker } from "./CategoryColorPicker";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { CATEGORY_COLOR_OPTIONS, validateCategoryName } from "@/lib/category-options";
import {
  CATEGORY_PAGE_SIZE,
  CATEGORY_SORT_OPTIONS,
  CATEGORY_TYPE_META,
  CategorySortKey,
  filterAndSortCategories,
  paginate,
} from "./category-explorer";

type CategoryExplorerProps = {
  categories: Category[];
  isLoading: boolean;
  /** Re-fetches the category list after a create, edit, or delete. */
  onChanged: () => void | Promise<void>;
};

const ALL_TYPES: CategoryType[] = ["EXPENSE", "INCOME"];
const DEFAULT_NEW_COLOR = CATEGORY_COLOR_OPTIONS[0]!.value;

const controlStyle: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "8px 10px",
  fontSize: "13px",
  color: "var(--text-primary)",
  cursor: "pointer",
  minWidth: 0,
};

/**
 * Single unified, filterable, sortable, paginated list of every custom category (both
 * expense and income), with inline create/edit/delete. Replaces the split expense/income
 * cards so both types can be browsed and compared side by side.
 */
export function CategoryExplorer({ categories, isLoading, onChanged }: CategoryExplorerProps) {
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<CategoryType[]>(ALL_TYPES);
  const [sort, setSort] = useState<CategorySortKey>("name_asc");
  const [page, setPage] = useState(1);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CategoryType>("EXPENSE");
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);
  const [newIcon, setNewIcon] = useState("");
  const [isSavingNew, setIsSavingNew] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredSorted = useMemo(
    () => filterAndSortCategories(categories, { search, activeTypes, sort }),
    [categories, search, activeTypes, sort]
  );
  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));
  const pageItems = useMemo(
    () => paginate(filteredSorted, page, CATEGORY_PAGE_SIZE),
    [filteredSorted, page]
  );

  /** Clamps the current page back into range whenever filtering shrinks the result set. */
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  /** Toggles a type filter pill, refusing to turn off the last active type. */
  function handleToggleType(type: CategoryType) {
    setActiveTypes((current) => {
      if (current.includes(type)) {
        if (current.length === 1) return current;
        return current.filter((activeType) => activeType !== type);
      }
      return [...current, type];
    });
    setPage(1);
  }

  /** Opens the add form with a fresh set of defaults. */
  function handleOpenAdd() {
    setIsAdding(true);
    setNewName("");
    setNewType(activeTypes.length === 1 ? activeTypes[0]! : "EXPENSE");
    setNewColor(DEFAULT_NEW_COLOR);
    setNewIcon("");
  }

  /** Creates the new category, then closes the form and refreshes the list. */
  async function handleCreate() {
    const nameError = validateCategoryName(newName);
    if (nameError) {
      toast.error(nameError);
      return;
    }
    setIsSavingNew(true);
    try {
      await api.createCategory({
        name: newName.trim(),
        type: newType,
        color: newColor,
        icon: newIcon || null,
      });
      toast.success(`${newName.trim()} created`);
      setIsAdding(false);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create category");
    } finally {
      setIsSavingNew(false);
    }
  }

  /** Opens inline edit mode for a category, pre-filling the edit inputs. */
  function handleStartEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColor(category.color);
    setEditIcon(category.icon ?? "");
  }

  /** Discards in-progress edits without saving. */
  function handleCancelEdit() {
    setEditingId(null);
  }

  /** Persists the edited name/color/icon, then refreshes the list. */
  async function handleSaveEdit() {
    if (!editingId) return;
    const nameError = validateCategoryName(editName);
    if (nameError) {
      toast.error(nameError);
      return;
    }
    setIsSavingEdit(true);
    try {
      await api.updateCategory(editingId, {
        name: editName.trim(),
        color: editColor,
        icon: editIcon || null,
      });
      toast.success(`${editName.trim()} updated`);
      setEditingId(null);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update category");
    } finally {
      setIsSavingEdit(false);
    }
  }

  /** Deletes the category pending confirmation, then refreshes the list. */
  async function handleConfirmDelete() {
    if (!pendingDeleteCategory) return;
    setIsDeleting(true);
    try {
      await api.deleteCategory(pendingDeleteCategory.id);
      toast.success(`${pendingDeleteCategory.name} deleted`);
      setPendingDeleteCategory(null);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete category");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="fade-up fade-up-2"
      style={{
        background: "var(--snapshot-gradient)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: "1 1 200px",
            minWidth: "160px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "8px 10px",
          }}
        >
          <Search size={15} style={{ flexShrink: 0, color: "var(--text-muted)" }} />
          <input
            aria-label="Search categories"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search categories…"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "13px",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {ALL_TYPES.map((type) => {
          const meta = CATEGORY_TYPE_META[type];
          const isOn = activeTypes.includes(type);
          return (
            <button
              key={type}
              type="button"
              className={`category-type-pill press${isOn ? " is-on" : ""}`}
              aria-pressed={isOn}
              aria-label={`${isOn ? "Hide" : "Show"} ${meta.label.toLowerCase()} categories`}
              onClick={() => handleToggleType(type)}
              style={
                {
                  "--pill-accent": meta.color,
                  "--pill-tint": `${meta.color}1a`,
                  "--pill-tint-hover": `${meta.color}2e`,
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                } as CSSProperties
              }
            >
              {meta.label}
            </button>
          );
        })}

        <select
          aria-label="Sort categories"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as CategorySortKey);
            setPage(1);
          }}
          style={controlStyle}
        >
          {CATEGORY_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {!isAdding && (
          <button
            type="button"
            className="budget-action-pill"
            onClick={handleOpenAdd}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "8px 14px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            <Plus size={14} /> Add category
          </button>
        )}
      </div>

      {isAdding && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "12px",
            marginBottom: "12px",
            borderRadius: "10px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <div role="radiogroup" aria-label="Category type" style={{ display: "flex", gap: "8px" }}>
            {ALL_TYPES.map((type) => {
              const meta = CATEGORY_TYPE_META[type];
              const isSelected = newType === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`category-type-pill press${isSelected ? " is-on" : ""}`}
                  onClick={() => setNewType(type)}
                  style={
                    {
                      "--pill-accent": meta.color,
                      "--pill-tint": `${meta.color}1a`,
                      "--pill-tint-hover": `${meta.color}2e`,
                      padding: "6px 12px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    } as CSSProperties
                  }
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            aria-label="New category name"
            placeholder="Category name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            style={baseInputStyle}
          />
          <CategoryColorPicker value={newColor} onChange={setNewColor} />
          <CategoryIconPicker value={newIcon} onChange={setNewIcon} />
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="press"
              onClick={() => setIsAdding(false)}
              disabled={isSavingNew}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface-1)",
                color: "var(--text-secondary)",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="press"
              onClick={handleCreate}
              disabled={isSavingNew}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "none",
                background: "var(--brand-accent)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: isSavingNew ? "default" : "pointer",
                opacity: isSavingNew ? 0.7 : 1,
              }}
            >
              {isSavingNew ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading categories…</p>
      ) : total === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          {categories.length === 0 ? "No categories yet." : "No categories match your filters."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "2px" }}>
          {pageItems.map((category) => (
            <CategoryListRow
              key={category.id}
              category={category}
              isEditing={editingId === category.id}
              editName={editName}
              editColor={editColor}
              editIcon={editIcon}
              isSavingEdit={isSavingEdit}
              onEditNameChange={setEditName}
              onEditColorChange={setEditColor}
              onEditIconChange={setEditIcon}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onRequestDelete={setPendingDeleteCategory}
            />
          ))}
        </ul>
      )}

      {total > CATEGORY_PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          <span className="num" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="press"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              style={paginationButtonStyle(page <= 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="press"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              style={paginationButtonStyle(page >= totalPages)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={pendingDeleteCategory !== null}
        onOpenChange={(open) => !open && setPendingDeleteCategory(null)}
        title={`Delete "${pendingDeleteCategory?.name ?? ""}"?`}
        description="This removes it from future category pickers. Transactions, budgets, and rules that already use this category keep it as plain text."
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}

/** Builds the style for a pagination button, dimming and disabling it when unavailable. */
function paginationButtonStyle(disabled: boolean) {
  return {
    background: "var(--surface-1)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "7px 14px",
    fontSize: "12px",
    fontWeight: 600,
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  } as const;
}
