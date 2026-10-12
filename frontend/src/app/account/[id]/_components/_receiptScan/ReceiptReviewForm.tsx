"use client";
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api, Account } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { inputStyle } from "@/lib/styles/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatLocalDate, toReceiptEffectiveAt } from "./receipt-date";
import {
  calculateUnexplainedDifference,
  computeReceiptSplits,
  sumReceiptItems,
} from "./receipt-splits";
import type { ParsedReceipt, ReceiptLineItem } from "./receipt-text-parser";

/** A scanned line item with the category chosen for it so far ("" until one is picked). */
export type ReceiptDraftItem = ReceiptLineItem & { category: string };

type ReceiptReviewFormProps = {
  account: Account;
  parsedReceipt: ParsedReceipt;
  draftItems: ReceiptDraftItem[];
  onItemCategoryChange: (itemIndex: number, category: string) => void;
  onAllItemCategoriesChange: (category: string) => void;
  onItemRemove: (itemIndex: number) => void;
  isSuggestingCategories: boolean;
  hasSuggestionFailed: boolean;
  expenseCategoryNames: string[];
  /** Called after the transaction is saved, so the parent can refresh and reset the scanner. */
  onCreated: () => void | Promise<void>;
  onDiscard: () => void;
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-secondary)",
  margin: 0,
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", appearance: "none" };

/**
 * Lets the user check and correct a scanned receipt before anything is saved: the store, date,
 * and total, plus a category for each item. The split by category is derived from those items,
 * so it always adds up to the total.
 */
export function ReceiptReviewForm({
  account,
  parsedReceipt,
  draftItems,
  onItemCategoryChange,
  onAllItemCategoriesChange,
  onItemRemove,
  isSuggestingCategories,
  hasSuggestionFailed,
  expenseCategoryNames,
  onCreated,
  onDiscard,
}: ReceiptReviewFormProps) {
  const isMobile = useIsMobile();
  const [merchant, setMerchant] = useState(parsedReceipt.merchant ?? "");
  const [receiptDate, setReceiptDate] = useState(
    () => parsedReceipt.date ?? formatLocalDate(new Date())
  );
  const [totalInput, setTotalInput] = useState(parsedReceipt.total?.toFixed(2) ?? "");
  const [wholeReceiptCategory, setWholeReceiptCategory] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const total = Math.round(parseFloat(totalInput) * 100) / 100;
  const isTotalValid = Number.isFinite(total) && total > 0;
  const hasItems = draftItems.length > 0;
  const uncategorizedItemCount = draftItems.filter((item) => !item.category).length;
  const splits =
    hasItems && isTotalValid && uncategorizedItemCount === 0
      ? computeReceiptSplits(draftItems, total)
      : [];
  const itemsTotal = sumReceiptItems(draftItems);
  const unexplainedDifference =
    hasItems && isTotalValid
      ? calculateUnexplainedDifference(
          itemsTotal,
          parsedReceipt.taxTotal,
          parsedReceipt.discountTotal,
          total
        )
      : 0;
  /** True when the purchase would exceed the current balance on a non-credit account. */
  const wouldOverdraw = account.accountType !== "CREDIT" && isTotalValid && total > account.balance;
  const isDateValid = toReceiptEffectiveAt(receiptDate, new Date()) !== null;
  const canCreate =
    isTotalValid && isDateValid && !wouldOverdraw && !isCreating && uncategorizedItemCount === 0;

  /** Saves the reviewed receipt as one transaction, split by category when it spans several. */
  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const effectiveAt = toReceiptEffectiveAt(receiptDate, new Date());
    if (!canCreate || !effectiveAt) return;
    setIsCreating(true);
    try {
      await api.recordReceiptPurchase(account.id, {
        amount: total,
        effectiveAt: effectiveAt.toISOString(),
        merchant: merchant.trim() || undefined,
        // Splits are ordered largest first, so a split purchase is labelled by its biggest share.
        category: hasItems ? splits[0]?.category : wholeReceiptCategory || undefined,
        splits: splits.length >= 2 ? splits : undefined,
      });
      toast.success("Transaction created");
      await onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create the transaction");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "10px" }}>
        <input
          type="text"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
          placeholder="Merchant (optional)"
          aria-label="Merchant"
          maxLength={100}
          style={{ ...inputStyle, flex: 2 }}
        />
        <input
          type="date"
          value={receiptDate}
          onChange={(event) => setReceiptDate(event.target.value)}
          max={formatLocalDate(new Date())}
          aria-label="Purchase date"
          style={{ ...inputStyle, flex: 1 }}
        />
        <div style={{ position: "relative", flex: 1 }}>
          <span
            className="num"
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-secondary)",
              fontSize: "14px",
              pointerEvents: "none",
            }}
          >
            $
          </span>
          <input
            type="number"
            value={totalInput}
            onChange={(event) => setTotalInput(event.target.value)}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            aria-label="Receipt total"
            style={{ ...inputStyle, paddingLeft: "28px" }}
          />
        </div>
      </div>

      {!isTotalValid && (
        <p style={{ fontSize: "12px", color: "#f87171", margin: 0 }}>
          Enter the receipt total to continue.
        </p>
      )}
      {wouldOverdraw && (
        <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>
          Insufficient funds — balance is {formatCurrency(account.balance)}.
        </p>
      )}

      {hasItems ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <p
              style={{
                ...sectionLabelStyle,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {draftItems.length} item{draftItems.length !== 1 ? "s" : ""}
              {isSuggestingCategories && (
                <span style={{ color: "#8b5cf6", textTransform: "none", letterSpacing: 0 }}>
                  ✦ AI suggesting…
                </span>
              )}
              {!isSuggestingCategories && hasSuggestionFailed && (
                <span style={{ color: "#f87171", textTransform: "none", letterSpacing: 0 }}>
                  AI suggestions unavailable
                </span>
              )}
            </p>
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) onAllItemCategoriesChange(event.target.value);
              }}
              aria-label="Set every item to one category"
              style={{
                ...selectStyle,
                width: isMobile ? "100%" : "190px",
                padding: "7px 12px",
                fontSize: "12px",
              }}
            >
              <option value="">Set all items to…</option>
              {expenseCategoryNames.map((categoryName) => (
                <option key={categoryName} value={categoryName}>
                  {categoryName}
                </option>
              ))}
            </select>
          </div>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {draftItems.map((item, itemIndex) => (
              <li
                key={itemIndex}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: isMobile ? "wrap" : "nowrap",
                  gap: "10px",
                  padding: "8px 12px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </span>
                <span
                  className="num"
                  style={{ fontSize: "13px", color: "var(--text-secondary)", flexShrink: 0 }}
                >
                  {formatCurrency(item.amount)}
                </span>
                <select
                  value={item.category}
                  onChange={(event) => onItemCategoryChange(itemIndex, event.target.value)}
                  aria-label={`Category for ${item.name}`}
                  style={{
                    ...selectStyle,
                    width: isMobile ? undefined : "170px",
                    flex: isMobile ? "1 1 100%" : undefined,
                    order: isMobile ? 1 : undefined,
                    padding: "7px 12px",
                    fontSize: "12px",
                    background: "var(--surface-1)",
                  }}
                >
                  <option value="">Choose category</option>
                  {expenseCategoryNames.map((categoryName) => (
                    <option key={categoryName} value={categoryName}>
                      {categoryName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="transaction-delete-button"
                  onClick={() => onItemRemove(itemIndex)}
                  aria-label={`Remove ${item.name}`}
                  title="Not a purchase? Remove this line"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "28px",
                    height: "28px",
                    padding: 0,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {uncategorizedItemCount > 0 && !isSuggestingCategories && (
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
              Choose a category for {uncategorizedItemCount} more item
              {uncategorizedItemCount !== 1 ? "s" : ""} to continue.
            </p>
          )}
          {unexplainedDifference !== 0 && (
            <p style={{ fontSize: "12px", color: "#d97706", margin: 0 }}>
              These items{parsedReceipt.taxTotal > 0 ? " and tax" : ""} don&apos;t add up to the
              total — they are {formatCurrency(Math.abs(unexplainedDifference))}{" "}
              {unexplainedDifference > 0 ? "under" : "over"}. Check the total and the items; any
              difference is spread across the categories.
            </p>
          )}
        </div>
      ) : (
        <select
          value={wholeReceiptCategory}
          onChange={(event) => setWholeReceiptCategory(event.target.value)}
          aria-label="Category"
          style={selectStyle}
        >
          <option value="">Category (optional)</option>
          {expenseCategoryNames.map((categoryName) => (
            <option key={categoryName} value={categoryName}>
              {categoryName}
            </option>
          ))}
        </select>
      )}

      {splits.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <p style={sectionLabelStyle}>
            {splits.length >= 2 ? `Split across ${splits.length} categories` : "Category"}
          </p>
          {splits.map((split) => (
            <div
              key={split.category}
              style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}
            >
              <span style={{ color: "var(--text-primary)" }}>{split.category}</span>
              <span className="num" style={{ color: "var(--text-secondary)" }}>
                {formatCurrency(split.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="submit"
          className="press"
          disabled={!canCreate}
          style={{
            padding: "10px 24px",
            background: "var(--brand-accent)",
            color: "#000",
            fontWeight: 700,
            fontSize: "14px",
            border: "none",
            borderRadius: "8px",
            cursor: canCreate ? "pointer" : "not-allowed",
            opacity: canCreate ? 1 : 0.45,
            transition: "opacity 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {isCreating ? "Creating…" : "Create transaction"}
        </button>
        <button
          type="button"
          className="budget-action-pill"
          onClick={onDiscard}
          disabled={isCreating}
          style={{
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: isCreating ? "not-allowed" : "pointer",
          }}
        >
          Discard scan
        </button>
      </div>
    </form>
  );
}
