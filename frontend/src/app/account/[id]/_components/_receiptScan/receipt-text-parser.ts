import { findKnownMerchant } from "./known-merchants";
import { formatLocalDate, toLocalCalendarDate } from "./receipt-date";

/** One purchased line on a receipt, as read from the scanned text. */
export type ReceiptLineItem = { name: string; amount: number };

export type ParsedReceipt = {
  merchant: string | null;
  /** Purchase date as YYYY-MM-DD, or null when no plausible date was found. */
  date: string | null;
  total: number | null;
  taxTotal: number;
  discountTotal: number;
  lineItems: ReceiptLineItem[];
};

/** A receipt line in two forms: as printed (for names) and upper-cased without accents (for keyword matching). */
type ReceiptLine = { text: string; keywords: string };

/** A price found at the end of a line, in cents, with the text that came before it. */
type TrailingPrice = { cents: number; label: string };

type ReceiptLineKind =
  | "taxSummary"
  | "subtotal"
  | "total"
  | "tax"
  | "discount"
  | "ignored"
  | "other";

const MAX_ITEM_NAME_LENGTH = 60;
const MAX_MERCHANT_NAME_LENGTH = 100;
/** A store prints its name at the very top, so only the first few lines are considered. */
const MERCHANT_SEARCH_LINE_COUNT = 6;
const UNNAMED_ITEM_NAME = "Item";
/** Bloom has no receipts from before this, so an earlier year is a misread, not a date. */
const EARLIEST_PLAUSIBLE_YEAR = 2000;

/**
 * A price ending a line: an optional minus and dollar sign, digits with optional comma thousands,
 * a decimal point or comma (French receipts print "4,99 $"), two cents digits, then an optional
 * dollar sign, trailing minus, and tax flag such as "H" or "GP". Scanners read the tax flag "O" as
 * a zero, so a lone zero set apart from the price counts as a flag too; a zero touching the price
 * does not, because that is a three-decimal quantity such as litres of fuel.
 */
const TRAILING_PRICE_PATTERN =
  /(^|[^\d.,])(-)?\$?\s?(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})\s?\$?\s?(-)?(?:\s?([A-Z]{1,3}|\*)|\s+0)?\s*$/i;

/** A product code followed by the one-letter flag some stores print after it ("007225003712 F"). */
const PRODUCT_CODE_WITH_FLAG_PATTERN = /\b\d{6,}\s+[A-Za-z]\s*$/;

/** Units that mark a trailing number as a weight or volume ("0.85 KG"), not a price. */
const MEASUREMENT_UNITS = new Set(["KG", "LB", "LBS", "ML", "OZ", "L"]);

/** Marks a line that only explains a quantity ("2 @ 1.99", "0.85 kg @ $1.74/kg", "3 x ..."). */
const QUANTITY_DETAIL_PATTERN = /@|\/\s?(?:KG|LB)\b|^\d+\s?X\s/i;

const TAX_SUMMARY_PATTERN = /\bTOTAL\s+(?:DES\s+)?TAX(?:E|ES)?\b|\bTAX(?:E|ES)?\s+TOTAL\b/;
const SUBTOTAL_PATTERN = /\bSUB\s?-?\s?TOTAL\b|\bSOUS\s?-?\s?TOTAL\b/;
const INFORMATIONAL_TOTAL_PATTERN =
  /\bTOTAL\s+(?:SAVINGS|SAVED|DISCOUNTS?|RABAIS|ECONOMIES?|ITEMS?|ARTICLES?|NUMBER|POINTS|QTY)\b/;
/** "TOTAL" must lead the line, so a product such as "COLGATE TOTAL" is not mistaken for the total. */
const TOTAL_PATTERN =
  /^[^A-Z]*(?:(?:GRAND|MONTANT|ORDER|SALE)\s+)?TOTAL\b|\bAMOUNT DUE\b|\bBALANCE DUE\b|\bMONTANT (?:DU|A PAYER)\b/;
const TAX_PATTERN = /\b(?:GST|HST|PST|QST|RST|TPS|TVQ|TVH|TVP|TAX|TAXE|TAXES)\b/;
const DISCOUNT_PATTERN = /\b(?:DISCOUNT|RABAIS|COUPON)\b/;
/** Priced lines that are neither purchases nor totals: how it was paid, loyalty, tips, rounding. */
const IGNORED_LINE_PATTERN =
  /\b(?:VISA|MASTERCARD|AMEX|DEBIT|INTERAC|CASH|COMPTANT|TENDER|TENDERED|ROUNDING|ARRONDI|TAXABLE|POINTS|SAVINGS|SAVED|ECONOMIES?|TIP|GRATUITY|POURBOIRE)\b/;
const NON_MERCHANT_PATTERN = /\b(?:RECEIPT|RECU|FACTURE|INVOICE|WELCOME|BIENVENUE|THANK|MERCI)\b/;

const MONTH_NAME_ALTERNATIVES =
  "JAN|FEB|FEV|MAR|APR|AVR|MAY|MAI|JUIN|JUIL|JUN|JUL|AUG|AOU|SEP|OCT|NOV|DEC";
/** English and French month names share these prefixes once accents are stripped. */
const MONTH_NUMBER_BY_PREFIX: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  FEV: 2,
  MAR: 3,
  APR: 4,
  AVR: 4,
  MAY: 5,
  MAI: 5,
  JUN: 6,
  JUIN: 6,
  JUL: 7,
  JUIL: 7,
  AUG: 8,
  AOU: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const YEAR_FIRST_DATE_PATTERN = /(?:^|\D)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/;
const DAY_MONTH_NAME_YEAR_PATTERN = new RegExp(
  `(?:^|\\D)(\\d{1,2})[\\s.-]*(${MONTH_NAME_ALTERNATIVES})[A-Z]*\\.?[\\s,.-]*(\\d{4}|\\d{2})(?!\\d)`
);
const MONTH_NAME_DAY_YEAR_PATTERN = new RegExp(
  `(?:^|[^A-Z])(${MONTH_NAME_ALTERNATIVES})[A-Z]*\\.?\\s*(\\d{1,2})(?:ST|ND|RD|TH)?[\\s,]+(\\d{4})(?!\\d)`
);
const YEAR_LAST_DATE_PATTERN = /(?:^|\D)(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)/;
const TWO_DIGIT_YEAR_DATE_PATTERN = /(?:^|\D)(\d{2})([-/.])(\d{2})\2(\d{2})(?!\d)/;

type DateParts = { year: number; month: number; day: number };

/** Splits the scanned text into non-empty lines, each kept as printed and in keyword-matching form. */
function toReceiptLines(receiptText: string): ReceiptLine[] {
  return receiptText
    .split(/\r?\n/)
    .map((rawLine) => rawLine.replace(/\s+/g, " ").trim())
    .filter((text) => text.length > 0)
    .map((text) => ({
      text,
      keywords: text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toUpperCase()
        // Scanners often read the letter O in "TOTAL" as a zero, and its L as a one.
        .replace(/T[O0]TA[L1]/g, "TOTAL"),
    }));
}

/** Counts the letters in a piece of text, to tell words from codes, prices, and scanner noise. */
function countLetters(text: string): number {
  return (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
}

/** Reads the price a line ends with, or null when it ends in something else (a code, a weight, words). */
function readTrailingPrice(lineText: string): TrailingPrice | null {
  const match = TRAILING_PRICE_PATTERN.exec(lineText);
  if (!match) return null;
  const [, precedingCharacter, leadingMinus, dollars, cents, trailingMinus, flag] = match;
  if (flag && MEASUREMENT_UNITS.has(flag.toUpperCase())) return null;
  const unsignedCents = Number(dollars!.replace(/,/g, "")) * 100 + Number(cents);
  return {
    cents: leadingMinus || trailingMinus ? -unsignedCents : unsignedCents,
    label: lineText.slice(0, match.index) + precedingCharacter,
  };
}

/** Decides what a line is about from its keywords; the order resolves lines that match several. */
function classifyLine(keywords: string): ReceiptLineKind {
  if (TAX_SUMMARY_PATTERN.test(keywords)) return "taxSummary";
  if (SUBTOTAL_PATTERN.test(keywords)) return "subtotal";
  if (INFORMATIONAL_TOTAL_PATTERN.test(keywords)) return "ignored";
  if (TOTAL_PATTERN.test(keywords)) return "total";
  if (TAX_PATTERN.test(keywords)) return "tax";
  if (DISCOUNT_PATTERN.test(keywords)) return "discount";
  if (IGNORED_LINE_PATTERN.test(keywords)) return "ignored";
  return "other";
}

/** Strips product codes, scanner noise, and stray punctuation from the text beside a price. */
function cleanItemName(label: string): string {
  return label
    .replace(PRODUCT_CODE_WITH_FLAG_PATTERN, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/[^A-Za-zÀ-ÿ0-9\s%&'./+-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.\-/'+&]+|[\s.\-/'+&]+$/g, "")
    .slice(0, MAX_ITEM_NAME_LENGTH)
    .trim();
}

/**
 * Names a priced line. Receipts often print the product on one line and its code, weight, or
 * quantity with the price on the next, so a line with no usable name of its own borrows the
 * unpriced line above it. Returns null for a quantity note with nothing above to name
 * ("2 @ 1.99" under an item that already carried the price), which is not a purchase.
 */
function resolveItemName(label: string, nameFromPreviousLine: string | null): string | null {
  const isQuantityDetail = QUANTITY_DETAIL_PATTERN.test(label);
  const ownName = cleanItemName(label);
  if (!isQuantityDetail && countLetters(ownName) >= 2) return ownName;
  if (nameFromPreviousLine) return nameFromPreviousLine;
  return isQuantityDetail ? null : UNNAMED_ITEM_NAME;
}

/**
 * Picks the store name from the top of the receipt: a well-known chain if one is printed there
 * (its logo rarely scans cleanly), otherwise the first line that reads as words rather than numbers.
 */
function findMerchant(lines: ReceiptLine[]): string | null {
  const headerLines = lines.slice(0, MERCHANT_SEARCH_LINE_COUNT);
  const knownMerchant = findKnownMerchant(headerLines.map((line) => line.text));
  if (knownMerchant) return knownMerchant;

  for (const line of headerLines) {
    const letterCount = countLetters(line.text);
    const visibleCharacterCount = line.text.replace(/\s/g, "").length;
    const isMostlyLetters = letterCount >= 3 && letterCount / visibleCharacterCount >= 0.6;
    if (!isMostlyLetters) continue;
    if (readTrailingPrice(line.text) || NON_MERCHANT_PATTERN.test(line.keywords)) continue;
    return line.text.slice(0, MAX_MERCHANT_NAME_LENGTH).trim();
  }
  return null;
}

/** Expands a two-digit year ("26") to this century; four-digit years pass through. */
function toFullYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

/**
 * Chooses among the ways a printed date could be read. Canadian receipts mix day-first,
 * month-first, and year-first orders, so every reading that is a real day and not in the future
 * is kept, and the most recent one wins — a receipt is usually scanned soon after the purchase.
 */
function pickMostRecentPastDate(readings: DateParts[], today: Date): string | null {
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  let mostRecent: Date | null = null;
  for (const reading of readings) {
    if (reading.year < EARLIEST_PLAUSIBLE_YEAR) continue;
    const date = toLocalCalendarDate(reading.year, reading.month, reading.day);
    if (!date || date > endOfToday) continue;
    if (!mostRecent || date > mostRecent) mostRecent = date;
  }
  return mostRecent ? formatLocalDate(mostRecent) : null;
}

/** Finds a purchase date on one line, trying unambiguous formats before ambiguous ones. */
function findDateOnLine(keywords: string, today: Date): string | null {
  const yearFirst = YEAR_FIRST_DATE_PATTERN.exec(keywords);
  if (yearFirst) {
    const reading = {
      year: Number(yearFirst[1]),
      month: Number(yearFirst[2]),
      day: Number(yearFirst[3]),
    };
    const date = pickMostRecentPastDate([reading], today);
    if (date) return date;
  }

  const dayMonthName = DAY_MONTH_NAME_YEAR_PATTERN.exec(keywords);
  if (dayMonthName) {
    const reading = {
      year: toFullYear(Number(dayMonthName[3])),
      month: MONTH_NUMBER_BY_PREFIX[dayMonthName[2]!]!,
      day: Number(dayMonthName[1]),
    };
    const date = pickMostRecentPastDate([reading], today);
    if (date) return date;
  }

  const monthNameDay = MONTH_NAME_DAY_YEAR_PATTERN.exec(keywords);
  if (monthNameDay) {
    const reading = {
      year: Number(monthNameDay[3]),
      month: MONTH_NUMBER_BY_PREFIX[monthNameDay[1]!]!,
      day: Number(monthNameDay[2]),
    };
    const date = pickMostRecentPastDate([reading], today);
    if (date) return date;
  }

  const yearLast = YEAR_LAST_DATE_PATTERN.exec(keywords);
  if (yearLast) {
    const [first, second, year] = [Number(yearLast[1]), Number(yearLast[2]), Number(yearLast[3])];
    const date = pickMostRecentPastDate(
      [
        { year, month: first, day: second },
        { year, month: second, day: first },
      ],
      today
    );
    if (date) return date;
  }

  const twoDigitYear = TWO_DIGIT_YEAR_DATE_PATTERN.exec(keywords);
  if (twoDigitYear) {
    const [first, second, third] = [
      Number(twoDigitYear[1]),
      Number(twoDigitYear[3]),
      Number(twoDigitYear[4]),
    ];
    return pickMostRecentPastDate(
      [
        { year: toFullYear(first), month: second, day: third },
        { year: toFullYear(third), month: first, day: second },
        { year: toFullYear(third), month: second, day: first },
      ],
      today
    );
  }

  return null;
}

/** Returns the first plausible purchase date printed anywhere on the receipt. */
function findReceiptDate(lines: ReceiptLine[], today: Date): string | null {
  for (const line of lines) {
    const date = findDateOnLine(line.keywords, today);
    if (date) return date;
  }
  return null;
}

/**
 * Reads the store, date, total, taxes, and purchased items out of a receipt's scanned text.
 * Everything here is deterministic — the numbers on a receipt are never left to the AI model.
 * Purchases are the priced lines above the first subtotal, tax, or total line; everything below
 * that point is totals and payment details. `today` anchors date reading so no purchase lands in
 * the future. The result is a best effort for the user to review, since scanned text is imperfect.
 */
export function parseReceiptText(receiptText: string, today: Date): ParsedReceipt {
  const lines = toReceiptLines(receiptText);
  const lineItems: ReceiptLineItem[] = [];
  const totalCandidatesInCents: number[] = [];
  let taxSummaryCents: number | null = null;
  let itemizedTaxCents = 0;
  let discountCents = 0;
  let hasReachedTotals = false;
  let isAwaitingTotalAmount = false;
  let nameFromPreviousLine: string | null = null;

  for (const line of lines) {
    const price = readTrailingPrice(line.text);
    const lineKind = classifyLine(line.keywords);

    // "TOTAL" printed alone, with its amount wrapped onto the next line by the scanner.
    const isWrappedTotalAmount =
      isAwaitingTotalAmount && price !== null && lineKind === "other" && !countLetters(price.label);
    isAwaitingTotalAmount = false;
    if (isWrappedTotalAmount) {
      totalCandidatesInCents.push(Math.abs(price!.cents));
      continue;
    }

    if (lineKind === "taxSummary") {
      if (price) {
        taxSummaryCents = Math.abs(price.cents);
        hasReachedTotals = true;
      }
    } else if (lineKind === "subtotal") {
      hasReachedTotals = true;
    } else if (lineKind === "total") {
      hasReachedTotals = true;
      if (price) totalCandidatesInCents.push(Math.abs(price.cents));
      else isAwaitingTotalAmount = true;
    } else if (lineKind === "tax") {
      // A tax line without an amount is a header ("GST# 12345 6789"), not the start of the totals.
      if (price) {
        itemizedTaxCents += Math.abs(price.cents);
        hasReachedTotals = true;
      }
    } else if (lineKind === "discount") {
      if (price && !hasReachedTotals) discountCents += Math.abs(price.cents);
    } else if (lineKind === "other" && !hasReachedTotals) {
      if (!price) {
        const candidateName = cleanItemName(line.text);
        nameFromPreviousLine = countLetters(candidateName) >= 3 ? candidateName : null;
        continue;
      }
      if (price.cents < 0) {
        discountCents += -price.cents;
      } else if (price.cents > 0) {
        const name = resolveItemName(price.label, nameFromPreviousLine);
        if (name) lineItems.push({ name, amount: price.cents / 100 });
      }
    }
    nameFromPreviousLine = null;
  }

  return {
    merchant: findMerchant(lines),
    date: findReceiptDate(lines, today),
    // A subtotal misread as "TOTAL", or a "TOTAL" before a tip, is always the smaller number.
    total: totalCandidatesInCents.length > 0 ? Math.max(...totalCandidatesInCents) / 100 : null,
    taxTotal: (taxSummaryCents ?? itemizedTaxCents) / 100,
    discountTotal: discountCents / 100,
    lineItems,
  };
}
