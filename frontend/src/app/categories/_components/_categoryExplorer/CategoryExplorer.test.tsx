import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category } from "@/lib/api";
import { CategoryExplorer } from "./CategoryExplorer";

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

/** Renders the explorer with default props, overriding only what a test needs. */
function renderExplorer(overrides: Partial<React.ComponentProps<typeof CategoryExplorer>> = {}) {
  const onChanged = vi.fn();
  const props = {
    categories: [makeCategory()],
    isLoading: false,
    onChanged,
    ...overrides,
  };
  return { onChanged, ...render(<CategoryExplorer {...props} />) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CategoryExplorer", () => {
  it("shows the empty state when there are no categories", () => {
    renderExplorer({ categories: [] });
    expect(screen.getByText("No categories yet.")).toBeInTheDocument();
  });

  it("shows a loading message while categories are loading", () => {
    renderExplorer({ isLoading: true, categories: [] });
    expect(screen.getByText("Loading categories…")).toBeInTheDocument();
  });

  it("lists both expense and income categories together with type tags", () => {
    renderExplorer({
      categories: [
        makeCategory({ id: "1", name: "Groceries", type: "EXPENSE" }),
        makeCategory({ id: "2", name: "Salary", type: "INCOME" }),
      ],
    });
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    // "Expense"/"Income" also appear on the filter pills, so each row tag is one of several matches.
    expect(screen.getAllByText("Expense").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Income").length).toBeGreaterThan(0);
  });

  it("filters by search text", () => {
    renderExplorer({
      categories: [
        makeCategory({ id: "1", name: "Groceries", type: "EXPENSE" }),
        makeCategory({ id: "2", name: "Salary", type: "INCOME" }),
      ],
    });

    fireEvent.change(screen.getByLabelText("Search categories"), {
      target: { value: "sal" },
    });

    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  it("hides a type when its filter pill is toggled off, and keeps at least one active", () => {
    renderExplorer({
      categories: [
        makeCategory({ id: "1", name: "Groceries", type: "EXPENSE" }),
        makeCategory({ id: "2", name: "Salary", type: "INCOME" }),
      ],
    });

    fireEvent.click(screen.getByLabelText("Hide expense categories"));
    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();

    // The remaining active pill can't be turned off, since at least one type must stay visible.
    fireEvent.click(screen.getByLabelText("Hide income categories"));
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  it("paginates beyond the first page", () => {
    const categories = Array.from({ length: 10 }, (_, index) =>
      makeCategory({ id: `cat-${index}`, name: `Category ${String(index).padStart(2, "0")}` })
    );
    renderExplorer({ categories });

    expect(screen.getByText("Category 00")).toBeInTheDocument();
    expect(screen.queryByText("Category 09")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.queryByText("Category 00")).not.toBeInTheDocument();
    expect(screen.getByText("Category 09")).toBeInTheDocument();
  });

  it("creates a new category with the selected type and reports success", async () => {
    apiMock.createCategory.mockResolvedValue(makeCategory({ id: "cat-2", name: "Hobbies" }));
    const { onChanged } = renderExplorer();

    fireEvent.click(screen.getByRole("button", { name: /add category/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Income" }));
    fireEvent.change(screen.getByLabelText("New category name"), {
      target: { value: "Hobbies" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(apiMock.createCategory).toHaveBeenCalledWith({
        name: "Hobbies",
        type: "INCOME",
        color: expect.any(String),
        icon: null,
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Hobbies created");
    expect(onChanged).toHaveBeenCalled();
  });

  it("rejects creating a category with a blank name", async () => {
    renderExplorer();

    fireEvent.click(screen.getByRole("button", { name: /add category/i }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Name is required"));
    expect(apiMock.createCategory).not.toHaveBeenCalled();
  });

  it("edits a category's name and reports success", async () => {
    apiMock.updateCategory.mockResolvedValue(makeCategory({ name: "Food" }));
    const { onChanged } = renderExplorer();

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
    renderExplorer();

    fireEvent.click(screen.getByLabelText("Edit Groceries"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));

    expect(screen.queryByLabelText("Category name")).not.toBeInTheDocument();
    expect(apiMock.updateCategory).not.toHaveBeenCalled();
  });

  it("deletes a category after confirmation and reports success", async () => {
    const { onChanged } = renderExplorer();

    fireEvent.click(screen.getByLabelText("Delete Groceries"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(apiMock.deleteCategory).toHaveBeenCalledWith("cat-1"));
    expect(toast.success).toHaveBeenCalledWith("Groceries deleted");
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows an error toast when delete fails", async () => {
    apiMock.deleteCategory.mockRejectedValue(new Error("boom"));
    renderExplorer();

    fireEvent.click(screen.getByLabelText("Delete Groceries"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
  });
});
