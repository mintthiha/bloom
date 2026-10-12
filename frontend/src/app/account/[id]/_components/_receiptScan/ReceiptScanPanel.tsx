"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Account } from "@/lib/api";
import { prepareReceiptImage } from "./prepare-receipt-image";
import { recognizeReceiptText } from "./recognize-receipt-text";
import { ParsedReceipt, parseReceiptText } from "./receipt-text-parser";
import { ReceiptDraftItem, ReceiptReviewForm } from "./ReceiptReviewForm";
import { streamReceiptItemCategories } from "./stream-receipt-categories";

/** Matches the backend's cap on how many item names one categorization request may carry. */
const MAX_SUGGESTED_ITEM_NAMES = 40;

type ScanStatus = "idle" | "reading" | "review";

type ReceiptScanPanelProps = {
  account: Account;
  expenseCategoryNames: string[];
  /** Called after a scanned receipt is saved as a transaction. */
  onCreated: () => void | Promise<void>;
};

/**
 * Turns a photo of a receipt into a transaction: reads the text on the device, pulls out the
 * store, date, total, and items, asks the AI for a category per item, and hands the result to a
 * review form. Nothing is saved until the user confirms there.
 */
export function ReceiptScanPanel({
  account,
  expenseCategoryNames,
  onCreated,
}: ReceiptScanPanelProps) {
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [readingProgress, setReadingProgress] = useState<number | null>(null);
  const [parsedReceipt, setParsedReceipt] = useState<ParsedReceipt | null>(null);
  const [draftItems, setDraftItems] = useState<ReceiptDraftItem[]>([]);
  const [isSuggestingCategories, setIsSuggestingCategories] = useState(false);
  const [hasSuggestionFailed, setHasSuggestionFailed] = useState(false);
  // Identifies the scan in progress, so a slow read that was cancelled or replaced is ignored.
  const latestScanNumberRef = useRef(0);
  const suggestionAbortRef = useRef<AbortController | null>(null);

  /** Stops any in-flight AI suggestions when the panel is removed from the page. */
  useEffect(() => {
    return () => suggestionAbortRef.current?.abort();
  }, []);

  /**
   * Streams AI category suggestions into the items that have no category yet. Identical item
   * names are sent once, and a suggestion never overwrites a category the user already chose.
   */
  async function suggestItemCategories(merchant: string | null, items: ReceiptDraftItem[]) {
    const itemNames = [...new Set(items.map((item) => item.name))].slice(
      0,
      MAX_SUGGESTED_ITEM_NAMES
    );
    if (itemNames.length === 0) return;

    const abortController = new AbortController();
    suggestionAbortRef.current = abortController;
    setIsSuggestingCategories(true);
    setHasSuggestionFailed(false);
    try {
      await streamReceiptItemCategories(
        { merchant, itemNames },
        (suggestion) => {
          const suggestedItemName = itemNames[suggestion.itemNumber - 1];
          if (suggestedItemName === undefined) return;
          setDraftItems((previousItems) =>
            previousItems.map((item) =>
              item.name === suggestedItemName && !item.category
                ? { ...item, category: suggestion.category }
                : item
            )
          );
        },
        abortController.signal
      );
    } catch {
      if (!abortController.signal.aborted) setHasSuggestionFailed(true);
    } finally {
      // A newer scan may already own these flags; only the current one may clear them.
      if (suggestionAbortRef.current === abortController) {
        suggestionAbortRef.current = null;
        setIsSuggestingCategories(false);
      }
    }
  }

  /** Reads the chosen photo, then opens the review form with what was found on the receipt. */
  async function handleImageSelected(imageFile: File | null) {
    if (!imageFile) return;
    const scanNumber = latestScanNumberRef.current + 1;
    latestScanNumberRef.current = scanNumber;
    suggestionAbortRef.current?.abort();
    setScanStatus("reading");
    setReadingProgress(null);

    let receipt: ParsedReceipt;
    try {
      const image = await prepareReceiptImage(imageFile);
      const receiptText = await recognizeReceiptText(image, (progressFraction) => {
        if (latestScanNumberRef.current === scanNumber) setReadingProgress(progressFraction);
      });
      receipt = parseReceiptText(receiptText, new Date());
    } catch {
      if (latestScanNumberRef.current !== scanNumber) return;
      toast.error("Couldn't read that image. Try a JPEG or PNG photo of the receipt.");
      setScanStatus("idle");
      return;
    }
    if (latestScanNumberRef.current !== scanNumber) return;

    if (receipt.total === null && receipt.lineItems.length === 0) {
      toast.error("Couldn't find any prices on that receipt. Try a sharper, well-lit photo.");
      setScanStatus("idle");
      return;
    }

    const items = receipt.lineItems.map((lineItem) => ({ ...lineItem, category: "" }));
    setParsedReceipt(receipt);
    setDraftItems(items);
    setScanStatus("review");
    void suggestItemCategories(receipt.merchant, items);
  }

  /** Abandons the current scan (reading or under review) and returns to the photo picker. */
  function resetScan() {
    latestScanNumberRef.current += 1;
    suggestionAbortRef.current?.abort();
    suggestionAbortRef.current = null;
    setIsSuggestingCategories(false);
    setHasSuggestionFailed(false);
    setParsedReceipt(null);
    setDraftItems([]);
    setScanStatus("idle");
  }

  /** Sets one item's category from the review form. */
  function handleItemCategoryChange(itemIndex: number, category: string) {
    setDraftItems((previousItems) =>
      previousItems.map((item, index) => (index === itemIndex ? { ...item, category } : item))
    );
  }

  /** Applies one category to every item, e.g. a restaurant bill that is all dining. */
  function handleAllItemCategoriesChange(category: string) {
    setDraftItems((previousItems) => previousItems.map((item) => ({ ...item, category })));
  }

  /** Drops a line that isn't a purchase, such as a misread loyalty or payment line. */
  function handleItemRemove(itemIndex: number) {
    setDraftItems((previousItems) => previousItems.filter((_, index) => index !== itemIndex));
  }

  /** Clears the finished scan, then lets the parent refresh the account. */
  async function handleCreated() {
    resetScan();
    await onCreated();
  }

  if (scanStatus === "review" && parsedReceipt) {
    return (
      <ReceiptReviewForm
        account={account}
        parsedReceipt={parsedReceipt}
        draftItems={draftItems}
        onItemCategoryChange={handleItemCategoryChange}
        onAllItemCategoriesChange={handleAllItemCategoriesChange}
        onItemRemove={handleItemRemove}
        isSuggestingCategories={isSuggestingCategories}
        hasSuggestionFailed={hasSuggestionFailed}
        expenseCategoryNames={expenseCategoryNames}
        onCreated={handleCreated}
        onDiscard={resetScan}
      />
    );
  }

  if (scanStatus === "reading") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <span
          role="status"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            color: "var(--text-secondary)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="spin"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          {readingProgress === null
            ? "Getting ready to read the receipt…"
            : `Reading receipt… ${Math.round(readingProgress * 100)}%`}
        </span>
        <button
          type="button"
          className="budget-action-pill"
          onClick={resetScan}
          style={{ padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
        Take or upload a photo of a receipt. Bloom reads it on this device — the photo itself is
        never uploaded — then suggests a category for each item. You review everything before a
        transaction is created.
      </p>
      <div>
        <label
          className="press"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 16px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          Choose receipt photo
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => {
              void handleImageSelected(event.target.files?.[0] ?? null);
              // Lets the same photo be picked again after a failed or discarded scan.
              event.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
