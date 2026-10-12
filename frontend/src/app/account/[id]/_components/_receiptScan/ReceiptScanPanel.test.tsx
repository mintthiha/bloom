import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptScanPanel } from "./ReceiptScanPanel";
import type { ReceiptItemCategorySuggestion } from "./stream-receipt-categories";
import type { Account } from "@/lib/api";

const { apiMock, imageMock, recognitionMock, streamMock } = vi.hoisted(() => ({
  apiMock: { recordReceiptPurchase: vi.fn() },
  imageMock: { prepareReceiptImage: vi.fn() },
  recognitionMock: { recognizeReceiptText: vi.fn() },
  streamMock: { streamReceiptItemCategories: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, ...apiMock } };
});
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("./prepare-receipt-image", () => imageMock);
vi.mock("./recognize-receipt-text", () => recognitionMock);
vi.mock("./stream-receipt-categories", () => streamMock);

import { toast } from "sonner";

const RECEIPT_TEXT = `CORNER STORE
2026-10-09
BANANAS 5.00
DISH SOAP 5.00
BANANAS 5.00
SUBTOTAL 15.00
HST 1.95
TOTAL 16.95`;

const ACCOUNT: Account = {
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
};

type SuggestionHandler = (suggestion: ReceiptItemCategorySuggestion) => void;

/** A promise whose settlement the test controls, for holding an async step open. */
function createDeferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

/** Renders the panel and returns the parent's onCreated spy. */
function renderPanel() {
  const onCreated = vi.fn().mockResolvedValue(undefined);
  render(
    <ReceiptScanPanel
      account={ACCOUNT}
      expenseCategoryNames={["Groceries", "Household"]}
      onCreated={onCreated}
    />
  );
  return { onCreated };
}

/** Picks a photo on the hidden file input, starting a scan. */
function selectPhoto() {
  const input = screen.getByLabelText("Choose receipt photo") as HTMLInputElement;
  const photo = new File(["fake image bytes"], "receipt.jpg", { type: "image/jpeg" });
  fireEvent.change(input, { target: { files: [photo] } });
  return photo;
}

beforeEach(() => {
  vi.clearAllMocks();
  imageMock.prepareReceiptImage.mockResolvedValue({ width: 100, height: 200 });
  recognitionMock.recognizeReceiptText.mockResolvedValue(RECEIPT_TEXT);
  streamMock.streamReceiptItemCategories.mockResolvedValue(undefined);
});

describe("ReceiptScanPanel", () => {
  it("starts with the photo picker and an explanation", () => {
    renderPanel();

    expect(screen.getByLabelText("Choose receipt photo")).toBeInTheDocument();
    expect(screen.getByText(/the photo itself is\s+never uploaded/)).toBeInTheDocument();
  });

  it("reads the chosen photo and opens the review form with the receipt's details", async () => {
    renderPanel();
    const photo = selectPhoto();

    expect(await screen.findByLabelText("Merchant")).toHaveValue("CORNER STORE");
    expect(imageMock.prepareReceiptImage).toHaveBeenCalledWith(photo);
    expect(screen.getByLabelText("Purchase date")).toHaveValue("2026-10-09");
    expect(screen.getByLabelText("Receipt total")).toHaveValue(16.95);
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("shows reading progress while the text is being recognized, and can be cancelled", async () => {
    const recognition = createDeferred<string>();
    recognitionMock.recognizeReceiptText.mockReturnValue(recognition.promise);
    renderPanel();
    selectPhoto();

    expect(await screen.findByText("Getting ready to read the receipt…")).toBeInTheDocument();
    await waitFor(() => expect(recognitionMock.recognizeReceiptText).toHaveBeenCalled());
    const reportProgress = recognitionMock.recognizeReceiptText.mock.calls[0]![1] as (
      progressFraction: number
    ) => void;
    act(() => reportProgress(0.42));
    expect(screen.getByText("Reading receipt… 42%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Choose receipt photo")).toBeInTheDocument();

    // The cancelled read finishing late must not reopen the review form.
    await act(async () => recognition.resolve(RECEIPT_TEXT));
    expect(screen.queryByLabelText("Merchant")).not.toBeInTheDocument();
    expect(streamMock.streamReceiptItemCategories).not.toHaveBeenCalled();
  });

  it("asks the AI about each distinct item name once", async () => {
    renderPanel();
    selectPhoto();
    await screen.findByLabelText("Merchant");

    expect(streamMock.streamReceiptItemCategories).toHaveBeenCalledWith(
      { merchant: "CORNER STORE", itemNames: ["BANANAS", "DISH SOAP"] },
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  it("fills in suggested categories as they arrive, for every item sharing the name", async () => {
    const stream = createDeferred<void>();
    streamMock.streamReceiptItemCategories.mockReturnValue(stream.promise);
    renderPanel();
    selectPhoto();
    await screen.findByLabelText("Merchant");
    expect(screen.getByText("✦ AI suggesting…")).toBeInTheDocument();

    const deliverSuggestion = streamMock.streamReceiptItemCategories.mock
      .calls[0]![1] as SuggestionHandler;
    act(() => deliverSuggestion({ itemNumber: 1, category: "Groceries" }));

    const bananaSelects = screen.getAllByLabelText("Category for BANANAS");
    expect(bananaSelects).toHaveLength(2);
    bananaSelects.forEach((select) => expect(select).toHaveValue("Groceries"));
    expect(screen.getByLabelText("Category for DISH SOAP")).toHaveValue("");

    await act(async () => stream.resolve());
    expect(screen.queryByText("✦ AI suggesting…")).not.toBeInTheDocument();
  });

  it("never overwrites a category the user already chose", async () => {
    const stream = createDeferred<void>();
    streamMock.streamReceiptItemCategories.mockReturnValue(stream.promise);
    renderPanel();
    selectPhoto();
    await screen.findByLabelText("Merchant");

    fireEvent.change(screen.getByLabelText("Category for DISH SOAP"), {
      target: { value: "Groceries" },
    });
    const deliverSuggestion = streamMock.streamReceiptItemCategories.mock
      .calls[0]![1] as SuggestionHandler;
    act(() => deliverSuggestion({ itemNumber: 2, category: "Household" }));

    expect(screen.getByLabelText("Category for DISH SOAP")).toHaveValue("Groceries");
    await act(async () => stream.resolve());
  });

  it("ignores a suggestion for an item number it never asked about", async () => {
    const stream = createDeferred<void>();
    streamMock.streamReceiptItemCategories.mockReturnValue(stream.promise);
    renderPanel();
    selectPhoto();
    await screen.findByLabelText("Merchant");

    const deliverSuggestion = streamMock.streamReceiptItemCategories.mock
      .calls[0]![1] as SuggestionHandler;
    act(() => deliverSuggestion({ itemNumber: 9, category: "Groceries" }));

    screen.getAllByLabelText(/^Category for /).forEach((select) => expect(select).toHaveValue(""));
    await act(async () => stream.resolve());
  });

  it("keeps the review form usable when AI suggestions fail", async () => {
    streamMock.streamReceiptItemCategories.mockRejectedValue(new Error("AI service unavailable"));
    renderPanel();
    selectPhoto();

    expect(await screen.findByText("AI suggestions unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("Merchant")).toHaveValue("CORNER STORE");
  });

  it("applies one category to every item and removes a line on request", async () => {
    renderPanel();
    selectPhoto();
    await screen.findByLabelText("Merchant");

    fireEvent.change(screen.getByLabelText("Set every item to one category"), {
      target: { value: "Household" },
    });
    screen
      .getAllByLabelText(/^Category for /)
      .forEach((select) => expect(select).toHaveValue("Household"));

    fireEvent.click(screen.getByRole("button", { name: "Remove DISH SOAP" }));
    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.queryByLabelText("Category for DISH SOAP")).not.toBeInTheDocument();
  });

  it("skips the AI entirely for a receipt with a total but no readable items", async () => {
    recognitionMock.recognizeReceiptText.mockResolvedValue("CORNER STORE\nTOTAL 16.95");
    renderPanel();
    selectPhoto();

    expect(await screen.findByLabelText("Receipt total")).toHaveValue(16.95);
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(streamMock.streamReceiptItemCategories).not.toHaveBeenCalled();
  });

  it("returns to the picker with an error when no prices can be found", async () => {
    recognitionMock.recognizeReceiptText.mockResolvedValue("blurry nonsense\nno numbers here");
    renderPanel();
    selectPhoto();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't find any prices on that receipt. Try a sharper, well-lit photo."
      )
    );
    expect(screen.getByLabelText("Choose receipt photo")).toBeInTheDocument();
  });

  it("returns to the picker with an error when the image can't be decoded", async () => {
    imageMock.prepareReceiptImage.mockRejectedValue(new Error("unsupported image"));
    renderPanel();
    selectPhoto();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't read that image. Try a JPEG or PNG photo of the receipt."
      )
    );
    expect(recognitionMock.recognizeReceiptText).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Choose receipt photo")).toBeInTheDocument();
  });

  it("discards a scan under review, cancelling its AI suggestions", async () => {
    const stream = createDeferred<void>();
    streamMock.streamReceiptItemCategories.mockReturnValue(stream.promise);
    renderPanel();
    selectPhoto();
    await screen.findByLabelText("Merchant");
    const suggestionSignal = streamMock.streamReceiptItemCategories.mock
      .calls[0]![2] as AbortSignal;

    fireEvent.click(screen.getByRole("button", { name: "Discard scan" }));

    expect(suggestionSignal.aborted).toBe(true);
    expect(screen.getByLabelText("Choose receipt photo")).toBeInTheDocument();
    await act(async () => stream.reject(new DOMException("Aborted", "AbortError")));
    expect(screen.queryByText("AI suggestions unavailable")).not.toBeInTheDocument();
  });

  it("creates the transaction, resets to the picker, and notifies the parent", async () => {
    apiMock.recordReceiptPurchase.mockResolvedValue(ACCOUNT);
    const { onCreated } = renderPanel();
    selectPhoto();
    await screen.findByLabelText("Merchant");

    fireEvent.change(screen.getByLabelText("Set every item to one category"), {
      target: { value: "Groceries" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create transaction" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(apiMock.recordReceiptPurchase).toHaveBeenCalledWith(
      "a-1",
      expect.objectContaining({ amount: 16.95, merchant: "CORNER STORE", category: "Groceries" })
    );
    expect(toast.success).toHaveBeenCalledWith("Transaction created");
    expect(screen.getByLabelText("Choose receipt photo")).toBeInTheDocument();
  });
});
