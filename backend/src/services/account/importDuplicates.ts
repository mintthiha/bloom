// Pure duplicate matching for CSV imports: decides which incoming rows are already on the account,
// so re-importing an overlapping bank export doesn't double-count transactions.

/** The fields a row or a stored transaction is compared on when looking for duplicates. */
export type DuplicateComparable = {
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number | string;
  effectiveAt: Date;
  description?: string | null;
  merchant?: string | null;
};

/** Lowercases, trims, and collapses internal whitespace so cosmetic differences don't hide a match. */
function normalizeText(text: string | null | undefined): string {
  return (text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Builds the identity of a transaction for duplicate matching: same direction, same amount to the
 * cent, same calendar day (UTC, which is how imported dates are stored), and same description.
 * Falls back to the merchant when there is no description, since some bank exports only fill one.
 */
export function buildDuplicateKey(transaction: DuplicateComparable): string {
  const amountInCents = Math.round(Number(transaction.amount) * 100);
  const day = transaction.effectiveAt.toISOString().slice(0, 10);
  const label = normalizeText(transaction.description) || normalizeText(transaction.merchant);
  return `${transaction.type}|${amountInCents}|${day}|${label}`;
}

/**
 * Returns the indexes of incoming rows that already exist among the account's transactions.
 * Matching is one-to-one: if the account holds one $4.50 coffee on a day and the file holds two
 * identical ones, only the first is a duplicate — the second is a genuine new purchase. Rows that
 * repeat within the file itself are never flagged against each other.
 */
export function findDuplicateRowIndexes(
  rows: DuplicateComparable[],
  existingTransactions: DuplicateComparable[]
): number[] {
  const unmatchedExistingCountByKey = new Map<string, number>();
  for (const existing of existingTransactions) {
    const key = buildDuplicateKey(existing);
    unmatchedExistingCountByKey.set(key, (unmatchedExistingCountByKey.get(key) ?? 0) + 1);
  }

  const duplicateRowIndexes: number[] = [];
  rows.forEach((row, index) => {
    const key = buildDuplicateKey(row);
    const unmatchedCount = unmatchedExistingCountByKey.get(key) ?? 0;
    if (unmatchedCount > 0) {
      duplicateRowIndexes.push(index);
      unmatchedExistingCountByKey.set(key, unmatchedCount - 1);
    }
  });
  return duplicateRowIndexes;
}

/** Returns the [start, end) UTC-day window covering every row, so only overlapping history is fetched. */
export function getImportDayWindow(rows: Pick<DuplicateComparable, "effectiveAt">[]) {
  if (rows.length === 0) return null;
  const times = rows.map((row) => row.effectiveAt.getTime());
  const start = new Date(Math.min(...times));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(Math.max(...times));
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
