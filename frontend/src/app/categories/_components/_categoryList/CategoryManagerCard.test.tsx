import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/api";
import { CategoryManagerCard } from "./CategoryManagerCard";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

/** Builds a Category fixture. */
function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    userId: "u-1",
    name: "Groceries",
    type: "EXPENSE",
    color: "#22c55e",
    icon: "🛒",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Renders the card with default props, overriding only what a test needs. */
function renderCard(overrides: Partial<React.ComponentProps<typeof CategoryManagerCard>> = {}) {
  const onChanged = vi.fn();
  const props = {
    eyebrow: "Expenses",
    title: "Expense categories",
    description: "desc",
    type: "EXPENSE" as const,
    categories: [makeCategory()],
    isLoading: false,
    onChanged,
    ...overrides,
  };
  return { onChanged, ...render(<CategoryManagerCard {...props} />) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CategoryManagerCard", () => {
  it("shows the empty state when there are no categories", () => {
    renderCard({ categories: [] });
    expect(screen.getByText("No categories yet.")).toBeInTheDocument();
  });

  it("shows a loading message while categories are loading", () => {
    renderCard({ isLoading: true, categories: [] });
    expect(screen.getByText("Loading categories…")).toBeInTheDocument();
  });

  it("lists categories with edit and delete controls", () => {
    renderCard();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit Groceries")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete Groceries")).toBeInTheDocument();
  });

  it("creates a new category and reports success", async () => {
    apiMock.createCategory.mockResolvedValue(makeCategory({ id: "cat-2", name: "Hobbies" }));
    const { onChanged } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    fireEvent.change(screen.getByLabelText("New category name"), {
      target: { value: "Hobbies" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(apiMock.createCategory).toHaveBeenCalledWith({
        name: "Hobbies",
        type: "EXPENSE",
        color: expect.any(String),
        icon: null,
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Hobbies created");
    expect(onChanged).toHaveBeenCalled();
  });

  it("rejects creating a category with a blank name", async () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Name is required"));
    expect(apiMock.createCategory).not.toHaveBeenCalled();
  });

  it("edits a category's name and reports success", async () => {
    apiMock.updateCategory.mockResolvedValue(makeCategory({ name: "Food" }));
    const { onChanged } = renderCard();

    fireEvent.click(screen.getByLabelText("Edit Groceries"));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));

    await waitFor(() =>
      expect(apiMock.updateCategory).toHaveBeenCalledWith("cat-1", {
        name: "Food",
        color: "#22c55e",
        icon: "🛒",
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Food updated");
    expect(onChanged).toHaveBeenCalled();
  });

  it("cancels an in-progress edit without saving", () => {
    renderCard();

    fireEvent.click(screen.getByLabelText("Edit Groceries"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));

    expect(screen.queryByLabelText("Category name")).not.toBeInTheDocument();
    expect(apiMock.updateCategory).not.toHaveBeenCalled();
  });

  it("deletes a category after confirmation and reports success", async () => {
    const { onChanged } = renderCard();

    fireEvent.click(screen.getByLabelText("Delete Groceries"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(apiMock.deleteCategory).toHaveBeenCalledWith("cat-1"));
    expect(toast.success).toHaveBeenCalledWith("Groceries deleted");
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows an error toast when delete fails", async () => {
    apiMock.deleteCategory.mockRejectedValue(new Error("boom"));
    renderCard();

    fireEvent.click(screen.getByLabelText("Delete Groceries"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
  });
});
