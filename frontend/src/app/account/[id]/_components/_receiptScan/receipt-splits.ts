/** A receipt line item's amount and the category it has been assigned. */
export type CategorizedReceiptItem = { category: string; amount: number };

/** One category's share of a receipt's total. */
export type ReceiptSplit = { category: string; amount: number };

/** Matches the backend's cap on how many splits one transaction can have. */
export const MAX_RECEIPT_SPLITS = 10;

/** Differences smaller than this are rounding noise between the items and the printed total. */
const RECONCILED_TOLERANCE_IN_CENTS = 2;

/** Converts a dollar amount to whole cents, so sums and shares are exact integers. */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Adds up line item amounts to the cent. */
export function sumReceiptItems(items: { amount: number }[]): number {
  return items.reduce((totalCents, item) => totalCents + toCents(item.amount), 0) / 100;
}

/**
 * Divides a receipt's total across the categories of its line items. Each category's share is
 * proportional to what its items cost, which spreads tax, tips, and discounts — the gap between
 * the items and the total — evenly instead of dumping them on one category. Shares are allotted
 * in whole cents by the largest-remainder method, so they always add up to the total exactly,
 * which the backend requires.
 * Returns one split per category, largest first: a single entry means the purchase belongs to
 * one category and needs no split at all. Returns an empty list when there is nothing to divide
 * (no positive total, or no items with a positive amount).
 */
export function computeReceiptSplits(
  items: CategorizedReceiptItem[],
  receiptTotal: number
): ReceiptSplit[] {
  const totalCents = toCents(receiptTotal);
  if (!Number.isFinite(totalCents) || totalCents <= 0) return [];

  const itemCentsByCategory = new Map<string, number>();
  for (const item of items) {
    const itemCents = toCents(item.amount);
    if (!Number.isFinite(itemCents) || itemCents <= 0) continue;
    itemCentsByCategory.set(
      item.category,
      (itemCentsByCategory.get(item.category) ?? 0) + itemCents
    );
  }
  const categoryWeights = [...itemCentsByCategory]
    .map(([category, weight]) => ({ category, weight }))
    .sort((first, second) => second.weight - first.weight);
  if (categoryWeights.length === 0) return [];

  // Beyond the cap, the smallest categories are folded into the largest rather than dropped,
  // so the full total is still accounted for.
  const keptWeights = categoryWeights.slice(0, MAX_RECEIPT_SPLITS);
  for (const overflow of categoryWeights.slice(MAX_RECEIPT_SPLITS)) {
    keptWeights[0]!.weight += overflow.weight;
  }

  const combinedWeight = keptWeights.reduce((sum, entry) => sum + entry.weight, 0);
  const shares = keptWeights.map((entry) => {
    const exactShare = (totalCents * entry.weight) / combinedWeight;
    const wholeCents = Math.floor(exactShare);
    return { category: entry.category, cents: wholeCents, remainder: exactShare - wholeCents };
  });
  const centsStillUnallotted = totalCents - shares.reduce((sum, share) => sum + share.cents, 0);
  const sharesByLargestRemainder = [...shares].sort(
    (first, second) => second.remainder - first.remainder
  );
  for (let index = 0; index < centsStillUnallotted; index += 1) {
    sharesByLargestRemainder[index % sharesByLargestRemainder.length]!.cents += 1;
  }

  // A category too small to earn a single cent can't be a split — the backend rejects zero amounts.
  return shares
    .filter((share) => share.cents > 0)
    .map((share) => ({ category: share.category, amount: share.cents / 100 }));
}

/**
 * Measures how far the receipt's total is from what its parts explain: the items, plus tax,
 * minus discounts. Returns the leftover in dollars (positive when the total is larger), or 0
 * when the receipt adds up — a non-zero result usually means a misread item or total.
 */
export function calculateUnexplainedDifference(
  itemsTotal: number,
  taxTotal: number,
  discountTotal: number,
  receiptTotal: number
): number {
  const differenceInCents =
    toCents(receiptTotal) - (toCents(itemsTotal) + toCents(taxTotal) - toCents(discountTotal));
  return Math.abs(differenceInCents) <= RECONCILED_TOLERANCE_IN_CENTS ? 0 : differenceInCents / 100;
}
