import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptDraftItem, ReceiptReviewForm } from "./ReceiptReviewForm";
import type { ParsedReceipt } from "./receipt-text-parser";
import type { Account } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({ apiMock: { recordReceiptPurchase: vi.fn() } }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

import { toast } from "sonner";

const EXPENSE_CATEGORY_NAMES = ["Groceries", "Household", "Dining"];

/** Builds an Account fixture. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "a-1",
    ownerName: "Test User",
    nickname: null,
    accountType: "CHEQUING",
    balance: 500,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    color: null,
    icon: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Builds a parsed receipt fixture: $20 of items plus $2.60 tax. */
function makeReceipt(overrides: Partial<ParsedReceipt> = {}): ParsedReceipt {
  return {
    merchant: "Walmart",
    date: "2026-10-09",
    total: 22.6,
    taxTotal: 2.6,
    discountTotal: 0,
    lineItems: [],
    ...overrides,
  };
}

const CATEGORIZED_ITEMS: ReceiptDraftItem[] = [
  { name: "BANANAS", amount: 5, category: "Groceries" },
  { name: "DISH SOAP", amount: 5, category: "Household" },
  { name: "MILK", amount: 10, category: "Groceries" },
];

/** Renders the form with default props, overridable per test, and returns its callback spies. */
function renderForm(overrides: Partial<React.ComponentProps<typeof ReceiptReviewForm>> = {}) {
  const callbacks = {
    onItemCategoryChange: vi.fn(),
    onAllItemCategoriesChange: vi.fn(),
    onItemRemove: vi.fn(),
    onCreated: vi.fn().mockResolvedValue(undefined),
    onDiscard: vi.fn(),
  };
  render(
    <ReceiptReviewForm
      account={makeAccount()}
      parsedReceipt={makeReceipt()}
      draftItems={CATEGORIZED_ITEMS}
      isSuggestingCategories={false}
      hasSuggestionFailed={false}
      expenseCategoryNames={EXPENSE_CATEGORY_NAMES}
      {...callbacks}
      {...overrides}
    />
  );
  return callbacks;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReceiptReviewForm", () => {
  it("prefills the store, date, and total read from the receipt", () => {
    renderForm();

    expect(screen.getByLabelText("Merchant")).toHaveValue("Walmart");
    expect(screen.getByLabelText("Purchase date")).toHaveValue("2026-10-09");
    expect(screen.getByLabelText("Receipt total")).toHaveValue(22.6);
  });

  it("lists every item with its amount and chosen category", () => {
    renderForm();

    expect(screen.getByText("3 items")).toBeInTheDocument();
    expect(screen.getByText("BANANAS")).toBeInTheDocument();
    expect(screen.getByLabelText("Category for BANANAS")).toHaveValue("Groceries");
    expect(screen.getByLabelText("Category for DISH SOAP")).toHaveValue("Household");
  });

  it("shows the category split with tax spread proportionally", () => {
    renderForm();

    // $15 groceries and $5 household of a $22.60 total: 75% and 25%.
    expect(screen.getByText("Split across 2 categories")).toBeInTheDocument();
    expect(screen.getByText("$16.95")).toBeInTheDocument();
    expect(screen.getByText("$5.65")).toBeInTheDocument();
  });

  it("creates a split transaction dated at local noon of the receipt's day", async () => {
    apiMock.recordReceiptPurchase.mockResolvedValue(makeAccount());
    const { onCreated } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Create transaction" }));

    await waitFor(() =>
      expect(apiMock.recordReceiptPurchase).toHaveBeenCalledWith("a-1", {
        amount: 22.6,
        effectiveAt: new Date(2026, 9, 9, 12).toISOString(),
        merchant: "Walmart",
        category: "Groceries",
        splits: [
          { category: "Groceries", amount: 16.95 },
          { category: "Household", amount: 5.65 },
        ],
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Transaction created");
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it("creates a plain single-category transaction when every item shares one category", async () => {
    apiMock.recordReceiptPurchase.mockResolvedValue(makeAccount());
    renderForm({
      draftItems: [
        { name: "BURGER", amount: 12, category: "Dining" },
        { name: "FRIES", amount: 8, category: "Dining" },
      ],
    });

    expect(screen.queryByText(/Split across/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create transaction" }));

    await waitFor(() =>
      expect(apiMock.recordReceiptPurchase).toHaveBeenCalledWith(
        "a-1",
        expect.objectContaining({ amount: 22.6, category: "Dining", splits: undefined })
      )
    );
  });

  it("uses the user's edits to the store and total", async () => {
    apiMock.recordReceiptPurchase.mockResolvedValue(makeAccount());
    renderForm();

    fireEvent.change(screen.getByLabelText("Merchant"), { target: { value: "  Costco  " } });
    fireEvent.change(screen.getByLabelText("Receipt total"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Create transaction" }));

    await waitFor(() =>
      expect(apiMock.recordReceiptPurchase).toHaveBeenCalledWith(
        "a-1",
        expect.objectContaining({
          amount: 40,
          merchant: "Costco",
          splits: [
            { category: "Groceries", amount: 30 },
            { category: "Household", amount: 10 },
          ],
        })
      )
    );
  });

  it("blocks creating until every item has a category", () => {
    renderForm({
      draftItems: [
        { name: "BANANAS", amount: 5, category: "Groceries" },
        { name: "DISH SOAP", amount: 5, category: "" },
      ],
    });

    expect(screen.getByText("Choose a category for 1 more item to continue.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create transaction" })).toBeDisabled();
    expect(screen.queryByText(/Split across/)).not.toBeInTheDocument();
  });

  it("shows AI progress instead of the category prompt while suggestions are streaming", () => {
    renderForm({
      draftItems: [{ name: "BANANAS", amount: 5, category: "" }],
      isSuggestingCategories: true,
    });

    expect(screen.getByText("✦ AI suggesting…")).toBeInTheDocument();
    expect(screen.queryByText(/Choose a category for/)).not.toBeInTheDocument();
  });

  it("says so when AI suggestions are unavailable", () => {
    renderForm({ hasSuggestionFailed: true });
    expect(screen.getByText("AI suggestions unavailable")).toBeInTheDocument();
  });

  it("reports category edits, bulk edits, and removals to the parent", () => {
    const { onItemCategoryChange, onAllItemCategoriesChange, onItemRemove } = renderForm();

    fireEvent.change(screen.getByLabelText("Category for DISH SOAP"), {
      target: { value: "Dining" },
    });
    expect(onItemCategoryChange).toHaveBeenCalledWith(1, "Dining");

    fireEvent.change(screen.getByLabelText("Set every item to one category"), {
      target: { value: "Household" },
    });
    expect(onAllItemCategoriesChange).toHaveBeenCalledWith("Household");

    fireEvent.click(screen.getByRole("button", { name: "Remove MILK" }));
    expect(onItemRemove).toHaveBeenCalledWith(2);
  });

  it("offers only the user's expense categories for an item", () => {
    renderForm();

    const options = within(screen.getByLabelText("Category for BANANAS")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Choose category",
      "Groceries",
      "Household",
      "Dining",
    ]);
  });

  it("warns when the items and tax don't add up to the total", () => {
    renderForm({ parsedReceipt: makeReceipt({ total: 30 }) });

    expect(
      screen.getByText(/These items and tax don't add up to the total — they are \$7\.40 under/)
    ).toBeInTheDocument();
  });

  it("shows no mismatch warning when the receipt adds up", () => {
    renderForm();
    expect(screen.queryByText(/don't add up/)).not.toBeInTheDocument();
  });

  it("requires a total when none was read from the receipt", () => {
    renderForm({ parsedReceipt: makeReceipt({ total: null }) });

    expect(screen.getByText("Enter the receipt total to continue.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create transaction" })).toBeDisabled();
  });

  it("blocks a purchase larger than the balance on a non-credit account", () => {
    renderForm({ account: makeAccount({ balance: 10 }) });

    expect(screen.getByText("Insufficient funds — balance is $10.00.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create transaction" })).toBeDisabled();
  });

  it("allows a purchase larger than the balance on a credit card", () => {
    renderForm({ account: makeAccount({ accountType: "CREDIT", balance: 0 }) });

    expect(screen.queryByText(/Insufficient funds/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create transaction" })).toBeEnabled();
  });

  it("falls back to one optional category when no items were read", async () => {
    apiMock.recordReceiptPurchase.mockResolvedValue(makeAccount());
    renderForm({ draftItems: [] });

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Dining" } });
    fireEvent.click(screen.getByRole("button", { name: "Create transaction" }));

    await waitFor(() =>
      expect(apiMock.recordReceiptPurchase).toHaveBeenCalledWith(
        "a-1",
        expect.objectContaining({ category: "Dining", splits: undefined })
      )
    );
  });

  it("defaults the date to today when the receipt had none, stamping it with the current time", async () => {
    apiMock.recordReceiptPurchase.mockResolvedValue(makeAccount());
    renderForm({ parsedReceipt: makeReceipt({ date: null }), draftItems: [] });
    const beforeCreate = Date.now();

    fireEvent.click(screen.getByRole("button", { name: "Create transaction" }));

    await waitFor(() => expect(apiMock.recordReceiptPurchase).toHaveBeenCalled());
    const { effectiveAt } = apiMock.recordReceiptPurchase.mock.calls[0]![1];
    expect(new Date(effectiveAt).getTime()).toBeGreaterThanOrEqual(beforeCreate);
    expect(new Date(effectiveAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("shows the server's error and stays on the form when creating fails", async () => {
    apiMock.recordReceiptPurchase.mockRejectedValue(new Error("Account is frozen"));
    const { onCreated } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Create transaction" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Account is frozen"));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create transaction" })).toBeEnabled();
  });

  it("discards the scan on request", () => {
    const { onDiscard } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Discard scan" }));

    expect(onDiscard).toHaveBeenCalled();
    expect(apiMock.recordReceiptPurchase).not.toHaveBeenCalled();
  });
});
