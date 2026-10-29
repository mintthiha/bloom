import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityFilterBar } from "./ActivityFilterBar";

/** Renders the bar with default props, overridable per test. */
function renderBar(overrides: Partial<React.ComponentProps<typeof ActivityFilterBar>> = {}) {
  const props = {
    searchInput: "",
    onSearchInputChange: vi.fn(),
    group: "",
    onGroupChange: vi.fn(),
    action: "",
    onActionChange: vi.fn(),
    sort: "date_desc" as const,
    onSortChange: vi.fn(),
    from: "",
    onFromChange: vi.fn(),
    to: "",
    onToChange: vi.fn(),
    hasActiveFilters: false,
    onClear: vi.fn(),
    onRefresh: vi.fn(),
    refreshing: false,
    ...overrides,
  };
  render(<ActivityFilterBar {...props} />);
  return props;
}

describe("ActivityFilterBar", () => {
  it("gives the search box an accessible name rather than relying on its placeholder", () => {
    renderBar();

    expect(screen.getByRole("textbox", { name: "Search activity" })).toBeInTheDocument();
  });

  it("relays typing in the search box", () => {
    const props = renderBar();

    fireEvent.change(screen.getByRole("textbox", { name: "Search activity" }), {
      target: { value: "budget" },
    });

    expect(props.onSearchInputChange).toHaveBeenCalledWith("budget");
  });
});
