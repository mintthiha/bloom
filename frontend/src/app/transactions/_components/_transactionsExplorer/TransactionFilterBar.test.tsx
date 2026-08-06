import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionFilterBar } from "./TransactionFilterBar";
import type { Account } from "@/lib/api";

/** Renders the bar with default props, overridable per test. */
function renderBar(overrides: Partial<React.ComponentProps<typeof TransactionFilterBar>> = {}) {
  const props = {
    accounts: [{ id: "a-1", nickname: null, ownerName: "Chequing" } as Account],
    searchInput: "",
    onSearchInputChange: vi.fn(),
    accountId: "",
    onAccountChange: vi.fn(),
    type: "",
    onTypeChange: vi.fn(),
    sort: "date_desc" as const,
    onSortChange: vi.fn(),
    from: "",
    onFromChange: vi.fn(),
    to: "",
    onToChange: vi.fn(),
    hasActiveFilters: false,
    onClear: vi.fn(),
    ...overrides,
  };
  render(<TransactionFilterBar {...props} />);
  return props;
}

describe("TransactionFilterBar", () => {
  it("lists each account as an option in the account filter", () => {
    renderBar();
    const select = screen.getByLabelText("Filter by account");
    expect(select).toHaveTextContent("All accounts");
    expect(select).toHaveTextContent("Chequing");
  });

  it("relays search, account, sort, and date changes to its callbacks", () => {
    const props = renderBar();

    fireEvent.change(screen.getByPlaceholderText(/Search description/), {
      target: { value: "coffee" },
    });
    fireEvent.change(screen.getByLabelText("Filter by account"), { target: { value: "a-1" } });
    fireEvent.change(screen.getByLabelText("Sort transactions"), {
      target: { value: "amount_desc" },
    });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-01-01" } });

    expect(props.onSearchInputChange).toHaveBeenCalledWith("coffee");
    expect(props.onAccountChange).toHaveBeenCalledWith("a-1");
    expect(props.onSortChange).toHaveBeenCalledWith("amount_desc");
    expect(props.onFromChange).toHaveBeenCalledWith("2026-01-01");
  });

  it("hides the clear button until filters are active", () => {
    renderBar({ hasActiveFilters: false });
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
  });

  it("clears filters when the clear button is pressed", () => {
    const props = renderBar({ hasActiveFilters: true });
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(props.onClear).toHaveBeenCalled();
  });
});
