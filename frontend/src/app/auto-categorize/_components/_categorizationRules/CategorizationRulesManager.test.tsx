import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategorizationRulesManager } from "./CategorizationRulesManager";
import type { AutoCategorizationRule } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    listCategorizationRules: vi.fn(),
    upsertCategorizationRule: vi.fn(),
    updateCategorizationRule: vi.fn(),
    deleteCategorizationRule: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Stub the confirm dialog to a single button (rendered only while open) that fires onConfirm.
vi.mock("@/components/ConfirmDeleteDialog", () => ({
  ConfirmDeleteDialog: ({
    open,
    title,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => void;
  }) => (open ? <button onClick={onConfirm}>{`confirm:${title}`}</button> : null),
}));

import { toast } from "sonner";

/** Builds an AutoCategorizationRule fixture. */
function makeRule(overrides: Partial<AutoCategorizationRule> = {}): AutoCategorizationRule {
  return {
    id: "r-1",
    userId: "u-1",
    merchant: "Loblaws",
    category: "Groceries",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as AutoCategorizationRule;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.listCategorizationRules.mockResolvedValue([]);
});

describe("CategorizationRulesManager", () => {
  it("shows the empty state when there are no rules", async () => {
    render(<CategorizationRulesManager />);
    expect(await screen.findByText(/No rules yet/)).toBeInTheDocument();
  });

  it("lists saved rules with edit and delete controls", async () => {
    apiMock.listCategorizationRules.mockResolvedValue([makeRule()]);
    render(<CategorizationRulesManager />);

    expect(await screen.findByText("Loblaws")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit rule for Loblaws" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete rule for Loblaws" })).toBeInTheDocument();
  });

  it("creates a rule and reports success", async () => {
    apiMock.upsertCategorizationRule.mockResolvedValue(
      makeRule({ id: "r-2", merchant: "Netflix", category: "Groceries" })
    );
    render(<CategorizationRulesManager />);
    await screen.findByText(/No rules yet/);

    fireEvent.change(screen.getByPlaceholderText("Merchant name, e.g. Loblaws"), {
      target: { value: "Netflix" },
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Groceries" } });
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));

    await waitFor(() =>
      expect(apiMock.upsertCategorizationRule).toHaveBeenCalledWith("Netflix", "Groceries")
    );
    expect(toast.success).toHaveBeenCalledWith("Rule saved: Netflix → Groceries");
  });

  it("deletes a rule after confirmation", async () => {
    apiMock.listCategorizationRules.mockResolvedValue([makeRule()]);
    apiMock.deleteCategorizationRule.mockResolvedValue(undefined);
    render(<CategorizationRulesManager />);
    await screen.findByText("Loblaws");

    fireEvent.click(screen.getByRole("button", { name: "Delete rule for Loblaws" }));
    fireEvent.click(await screen.findByRole("button", { name: "confirm:Delete rule?" }));

    await waitFor(() => expect(apiMock.deleteCategorizationRule).toHaveBeenCalledWith("r-1"));
  });

  it("saves an inline edit", async () => {
    apiMock.listCategorizationRules.mockResolvedValue([makeRule()]);
    apiMock.updateCategorizationRule.mockResolvedValue(
      makeRule({ merchant: "Loblaw City", category: "Groceries" })
    );
    render(<CategorizationRulesManager />);
    await screen.findByText("Loblaws");

    fireEvent.click(screen.getByRole("button", { name: "Edit rule for Loblaws" }));
    const editInput = screen.getByPlaceholderText("Merchant name");
    fireEvent.change(editInput, { target: { value: "Loblaw City" } });
    fireEvent.submit(editInput.closest("form")!);

    await waitFor(() =>
      expect(apiMock.updateCategorizationRule).toHaveBeenCalledWith(
        "r-1",
        "Loblaw City",
        "Groceries"
      )
    );
  });
});
