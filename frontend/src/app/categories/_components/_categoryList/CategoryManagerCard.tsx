"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api, Category, CategoryType } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { inputStyle as baseInputStyle } from "@/lib/styles/input";
import { CategoryRow } from "./CategoryRow";
import { CategoryColorPicker } from "./CategoryColorPicker";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { CATEGORY_COLOR_OPTIONS, validateCategoryName } from "./category-options";

type CategoryManagerCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  type: CategoryType;
  categories: Category[];
  isLoading: boolean;
  /** Re-fetches the category list after a create, edit, or delete. */
  onChanged: () => void | Promise<void>;
};

const DEFAULT_NEW_COLOR = CATEGORY_COLOR_OPTIONS[0]!.value;

/**
 * One card managing every category of a single type (income or expense): the
 * list, an inline add form, inline rename/recolor, and delete with confirmation.
 */
export function CategoryManagerCard({
  eyebrow,
  title,
  description,
  type,
  categories,
  isLoading,
  onChanged,
}: CategoryManagerCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
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

  /** Opens the add form with a fresh set of defaults. */
  function handleOpenAdd() {
    setIsAdding(true);
    setNewName("");
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
        type,
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
    <CollapsibleCard
      className="fade-up"
      eyebrow={eyebrow}
      title={title}
      description={description}
      headerRight={
        !isAdding && (
          <button
            type="button"
            className="budget-action-pill"
            onClick={handleOpenAdd}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Add
          </button>
        )
      }
    >
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
                background: "#3b82f6",
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
      ) : categories.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>No categories yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "2px" }}>
          {categories.map((category) => (
            <CategoryRow
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

      <ConfirmDeleteDialog
        open={pendingDeleteCategory !== null}
        onOpenChange={(open) => !open && setPendingDeleteCategory(null)}
        title={`Delete "${pendingDeleteCategory?.name ?? ""}"?`}
        description="This removes it from future category pickers. Transactions, budgets, and rules that already use this category keep it as plain text."
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </CollapsibleCard>
  );
}
