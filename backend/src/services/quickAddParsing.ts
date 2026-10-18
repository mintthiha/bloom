import { AppError } from "../middleware/errorHandler";
import { findMatchingName, readTextArgument } from "./chatActionProposals";

/** Whether the note describes money going out or coming in. */
export type QuickAddDirection = "EXPENSE" | "INCOME";

/**
 * A transaction read from a one-line note, for pre-filling the new-transaction form. Anything the
 * note didn't make clear is null, so the form leaves that field for the user.
 */
export type QuickAddDraft = {
  direction: QuickAddDirection;
  amount: number | null;
  merchant: string | null;
  /** One of the user's own categories for that direction. */
  category: string | null;
  /** YYYY-MM-DD, in the user's own calendar; today when the note doesn't say. */
  date: string;
};

/** The user's own categories, the only values a draft's category may take. */
export type QuickAddCategories = {
  expenseCategoryNames: string[];
  incomeCategoryNames: string[];
};

/** What the model's reply is read against: the note itself, the user's today, and categories. */
export type QuickAddContext = {
  note: string;
  /** YYYY-MM-DD, the user's local date. */
  today: string;
  categories: QuickAddCategories;
};

// The same length limit the transaction routes enforce on a merchant.
const MAX_MERCHANT_LENGTH = 100;
// Far above any purchase someone would quick-add, so a misread number can't fill in a wild amount.
const MAX_AMOUNT = 1_000_000;
// How far back a note's date may reach; older dates are almost always a misread year.
const MAX_DAYS_BACK = 730;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// Numbers typed in the note, e.g. "4.50", "$1,200", "12".
const TYPED_NUMBER_PATTERN = /\d[\d,]*(?:\.\d+)?/g;
// A month's full name or usual abbreviation; any other word ("market 12") is not a date.
const MONTH_NAME_PATTERN =
  "(?:january|february|march|april|may|june|july|august|september|october|november|december|" +
  "jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?";
// Numbers that belong to a date rather than an amount.
const DATE_NUMBER_PATTERNS = [
  /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
  /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
  /\b\d+\s+days?\s+ago\b/gi,
  new RegExp(`\\b${MONTH_NAME_PATTERN}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b(?:,?\\s+\\d{4})?`, "gi"),
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_NAME_PATTERN}`, "gi"),
];

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Words too common to show that the note names a merchant, e.g. the "the" of "The Keg".
const FILLER_WORDS = new Set(["the", "and", "of", "at", "co", "inc", "ltd"]);

const SMALL_NUMBER_WORDS: Record<string, number> = {
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
};

/** Reads a YYYY-MM-DD string as a UTC calendar day, or null when it isn't a real day. */
function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? date : null;
}

/** Moves a YYYY-MM-DD calendar day back by a number of days. */
function daysBefore(day: string, dayCount: number): string {
  const date = parseDateOnly(day)!;
  date.setUTCDate(date.getUTCDate() - dayCount);
  return date.toISOString().slice(0, 10);
}

/**
 * Works out a date the note gives in relative words — "yesterday", "3 days ago", "on Monday" —
 * against the user's today. Done here rather than by the model, which gets this arithmetic wrong.
 * Returns null when the note uses none of these words.
 */
function resolveRelativeDate(note: string, today: string): string | null {
  const text = note.toLowerCase();
  if (/\b(today|tonight|this morning|this afternoon)\b/.test(text)) return today;
  if (/\bday before yesterday\b/.test(text)) return daysBefore(today, 2);
  if (/\b(yesterday|last night)\b/.test(text)) return daysBefore(today, 1);
  const daysAgoMatch = /\b(\d+|a|one|two|three|four|five|six|seven) days? ago\b/.exec(text);
  if (daysAgoMatch) {
    const dayCount = SMALL_NUMBER_WORDS[daysAgoMatch[1]!] ?? Number(daysAgoMatch[1]);
    return dayCount <= MAX_DAYS_BACK ? daysBefore(today, dayCount) : null;
  }
  const weekdayIndex = WEEKDAY_NAMES.findIndex((weekday) =>
    new RegExp(`\\b${weekday}\\b`).test(text)
  );
  if (weekdayIndex >= 0) {
    // The most recent such day before today: on a Wednesday, "Monday" is two days back.
    const todayIndex = parseDateOnly(today)!.getUTCDay();
    return daysBefore(today, (todayIndex - weekdayIndex + 7) % 7 || 7);
  }
  return null;
}

/** Accepts the model's date only when it is a real day, not in the future, and not years back. */
function readModelDate(value: unknown, today: string): string | null {
  if (typeof value !== "string") return null;
  const date = parseDateOnly(value);
  if (!date || value > today || value < daysBefore(today, MAX_DAYS_BACK)) return null;
  return value;
}

/**
 * The numbers in the note that could be its amount, in whole cents: every number typed, except
 * those that are part of a date ("3 days ago", "Oct 3", "10/03", "2026-10-03").
 */
function listTypedAmountsInCents(note: string): number[] {
  const noteWithoutDates = DATE_NUMBER_PATTERNS.reduce(
    (remainingText, datePattern) => remainingText.replace(datePattern, " "),
    note
  );
  const typedNumbers = noteWithoutDates.match(TYPED_NUMBER_PATTERN) ?? [];
  return typedNumbers
    .map((typed) => Math.round(Number(typed.replace(/,/g, "")) * 100))
    .filter((amountInCents) => amountInCents > 0 && amountInCents <= MAX_AMOUNT * 100);
}

/**
 * Accepts the model's amount only when it is one the user typed. A small model otherwise fills in
 * a plausible price for "coffee at Tim's", and a made-up amount in a pre-filled form is easy to
 * miss. When the model gives none it can use (it skips a bare "88" it would read as "$88"), a note
 * with exactly one number besides its date takes that number.
 */
function readModelAmount(value: unknown, note: string): number | null {
  const typedAmountsInCents = listTypedAmountsInCents(note);
  const amount = typeof value === "string" ? Number(value.replace(/[$,]/g, "")) : value;
  const modelAmountInCents =
    typeof amount === "number" && Number.isFinite(amount) ? Math.round(amount * 100) : null;
  if (modelAmountInCents !== null && typedAmountsInCents.includes(modelAmountInCents)) {
    return modelAmountInCents / 100;
  }
  return typedAmountsInCents.length === 1 ? typedAmountsInCents[0]! / 100 : null;
}

/** Splits text into lowercase words of letters and digits. */
function toWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Accepts the model's merchant only when one of its words starts like a word of the note, so a
 * nickname still expands ("Tim's" to "Tim Hortons") but an invented one ("lunch with Sam" became
 * "Restaurant") is dropped.
 */
function readModelMerchant(value: unknown, note: string): string | null {
  const merchant = readTextArgument(value, MAX_MERCHANT_LENGTH);
  if (!merchant) return null;
  const noteWords = new Set(toWords(note));
  const notePrefixes = new Set([...noteWords].map((word) => word.slice(0, 3)));
  const isNamedInNote = toWords(merchant)
    .filter((word) => !FILLER_WORDS.has(word))
    .some((word) =>
      // A short word such as the "a" and "w" of A&W has to appear whole.
      word.length >= 3 ? notePrefixes.has(word.slice(0, 3)) : noteWords.has(word)
    );
  return isNamedInNote ? merchant : null;
}

/** Names today's weekday so the model can read "Monday" without doing calendar arithmetic. */
function describeWeekday(today: string): string {
  const weekday = WEEKDAY_NAMES[parseDateOnly(today)!.getUTCDay()]!;
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

/** Builds the instructions that turn a note into the draft's JSON, with the user's categories. */
export function buildQuickAddSystemPrompt(categories: QuickAddCategories, today: string): string {
  const listOrNone = (names: string[]) => (names.length > 0 ? names.join(", ") : "(none)");
  return [
    `You read a short note about one transaction for a Canadian personal finance app. Today is ` +
      `${describeWeekday(today)}, ${today}.`,
    `Reply with only this JSON object: {"type":"expense" or "income","amount":number or null,` +
      `"merchant":string or null,"category":string or null,"date":"YYYY-MM-DD" or null}.`,
    `- type: "income" for money received (pay, refund, e-transfer in); otherwise "expense".`,
    `- amount: the dollar amount written in the note, or null if it has none. Never guess one.`,
    `- merchant: the business the money went to or came from, by its usual full name (for ` +
      `example, "Tim's" is "Tim Hortons"), or null if the note names no business.`,
    `- category: for an expense, exactly one of: ${listOrNone(categories.expenseCategoryNames)}. ` +
      `For income, exactly one of: ${listOrNone(categories.incomeCategoryNames)}. Null if none fits.`,
    `- date: the day it happened, or null if the note doesn't say.`,
  ].join("\n");
}

/**
 * Reads the model's JSON reply into a draft, keeping only what holds up: an amount the user typed,
 * a merchant the note names, a category that is theirs, and a date that is real and not in the
 * future. Relative dates are
 * worked out from the note itself rather than taken from the model.
 */
export function interpretQuickAddReply(
  content: string,
  { note, today, categories }: QuickAddContext
): QuickAddDraft {
  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    throw new AppError(502, "AI returned invalid JSON");
  }
  if (parsedContent === null || typeof parsedContent !== "object" || Array.isArray(parsedContent)) {
    throw new AppError(502, "AI returned unexpected response format");
  }
  const reply = parsedContent as Record<string, unknown>;

  const direction: QuickAddDirection =
    typeof reply.type === "string" && reply.type.toLowerCase() === "income" ? "INCOME" : "EXPENSE";
  const requestedCategory = readTextArgument(reply.category, MAX_MERCHANT_LENGTH);
  const allowedCategories =
    direction === "INCOME" ? categories.incomeCategoryNames : categories.expenseCategoryNames;

  return {
    direction,
    amount: readModelAmount(reply.amount, note),
    merchant: readModelMerchant(reply.merchant, note),
    category: requestedCategory ? findMatchingName(allowedCategories, requestedCategory) : null,
    date: resolveRelativeDate(note, today) ?? readModelDate(reply.date, today) ?? today,
  };
}

/** Whether a value is a real YYYY-MM-DD calendar day, for validating the caller's today. */
export function isDateOnly(value: string): boolean {
  return parseDateOnly(value) !== null;
}
