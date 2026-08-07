import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectableBudgetRow } from "./SelectableBudgetRow";
import type { Budget } from "@/lib/api";

const budget = { id: "b-1", category: "Groceries" } as Budget;

describe("SelectableBudgetRow", () => {
  it("renders a labelled checkbox reflecting the shown state and its children", () => {
    render(
      <SelectableBudgetRow budget={budget} shownOnDashboard onToggle={vi.fn()}>
        <div>card-body</div>
      </SelectableBudgetRow>
    );
    const checkbox = screen.getByRole("checkbox", {
      name: "Show Groceries on the dashboard card",
    });
    expect(checkbox).toBeChecked();
    expect(screen.getByText("card-body")).toBeInTheDocument();
  });

  it("reflects an unchecked state and fires onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(
      <SelectableBudgetRow budget={budget} shownOnDashboard={false} onToggle={onToggle}>
        <div>card-body</div>
      </SelectableBudgetRow>
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalled();
  });
});
