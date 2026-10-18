import type { OllamaChatMessage, OllamaToolDefinition } from "../lib/ollama-client";
import {
  findMatchingName,
  mentionsPhrase,
  readTextArgument,
  type ChatActionReferenceData,
  type ToolCallContext,
} from "./chatActionProposals";

export const LOOK_UP_SPENDING_TOOL_NAME = "look_up_spending";

/** The periods the model may ask about, as it sees them. */
const SPENDING_PERIODS = [
  "this month",
  "last month",
  "last 3 months",
  "this year",
  "last year",
  "all time",
] as const;

type SpendingPeriod = (typeof SPENDING_PERIODS)[number];

// The same length limits the categorization rule and category routes enforce.
const MAX_MERCHANT_LENGTH = 100;
const MAX_CATEGORY_LENGTH = 50;

// Far enough out that "all time" never cuts off a transaction, and still a valid Postgres date.
const END_OF_ALL_TIME = new Date(Date.UTC(9999, 0, 1));

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

// A month by name, at least its first three letters, with an optional year: "Sept", "march 2025".
const NAMED_MONTH_PATTERN = /^([a-z]{3,9})\.?(?:,?\s+(\d{4}))?$/i;

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

// How a question names one of the periods in its own words, so they win over a period the model
// dropped.
const QUESTION_PERIOD_PATTERNS: [SpendingPeriod, RegExp][] = [
  ["last 3 months", /\b(last|past)\s+(3|three)\s+months\b/i],
  ["last month", /\b(last|previous|past)\s+month\b/i],
  ["this month", /\bthis\s+month\b/i],
  ["last year", /\b(last|previous|past)\s+year\b/i],
  ["this year", /\b(this\s+year|year\s+to\s+date|ytd)\b/i],
  ["all time", /\b(all[-\s]time|ever)\b/i],
];

/** What to add up: purchases in a date range, optionally at one merchant and in one category. */
export type SpendingLookupQuery = {
  /** Matched against each transaction's merchant and description, ignoring case. */
  merchant: string | null;
  category: string | null;
  start: Date;
  /** Exclusive. */
  end: Date;
  /** How the answer names the period, e.g. "in September 2026". */
  periodLabel: string;
};

/** What the lookup found for a query. */
export type SpendingLookupResult = {
  total: number;
  purchaseCount: number;
  largestPurchase: { amount: number; effectiveAt: Date; label: string | null } | null;
};

/**
 * The arguments a lookup ran with, as they are stored on the reply and replayed to the model. They
 * carry the corrections made to what the model sent, so the replayed call shows the right one.
 */
export type SpendingLookupArguments = {
  merchant?: string;
  category?: string;
  period?: SpendingPeriod;
  /** YYYY-MM. */
  month?: string;
};

/**
 * The model's arguments read into a query to run, or a question to put back to the user, together
 * with the arguments to store for replaying the call.
 */
export type SpendingLookupInterpretation =
  | { query: SpendingLookupQuery; reply: null; lookupArguments: SpendingLookupArguments }
  | { query: null; reply: string; lookupArguments: SpendingLookupArguments };

/** A period resolved against today: its UTC bounds, the words the answer uses, and its argument. */
type ResolvedPeriod = {
  start: Date;
  end: Date;
  periodLabel: string;
  periodArgument: Pick<SpendingLookupArguments, "period" | "month">;
};

/** Names a month the way an answer says it, e.g. "September 2026". */
function describeMonth(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Formats a dollar amount the way the rest of Bloom shows money, e.g. "$1,204.50". */
function formatDollars(amount: number): string {
  return amount.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

/** Formats a purchase date as a short day, e.g. "Sep 12". */
function formatPurchaseDay(date: Date): string {
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Resolves one of the named periods against today, in UTC like Bloom's monthly summaries. */
function resolveNamedPeriod(
  period: SpendingPeriod,
  today: Date
): Omit<ResolvedPeriod, "periodArgument"> {
  const year = today.getUTCFullYear();
  const monthIndex = today.getUTCMonth();
  const startOfMonth = (offset: number) => new Date(Date.UTC(year, monthIndex + offset, 1));
  switch (period) {
    case "this month":
      return {
        start: startOfMonth(0),
        end: startOfMonth(1),
        periodLabel: `so far in ${describeMonth(year, monthIndex)}`,
      };
    case "last month":
      return {
        start: startOfMonth(-1),
        end: startOfMonth(0),
        periodLabel: `in ${describeMonth(year, monthIndex - 1)}`,
      };
    case "last 3 months": {
      const start = startOfMonth(-2);
      const firstDay = start.toLocaleDateString("en-CA", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
      return { start, end: startOfMonth(1), periodLabel: `since ${firstDay}` };
    }
    case "this year":
      return {
        start: new Date(Date.UTC(year, 0, 1)),
        end: new Date(Date.UTC(year + 1, 0, 1)),
        periodLabel: `so far in ${year}`,
      };
    case "last year":
      return {
        start: new Date(Date.UTC(year - 1, 0, 1)),
        end: new Date(Date.UTC(year, 0, 1)),
        periodLabel: `in ${year - 1}`,
      };
    case "all time":
      return { start: new Date(0), end: END_OF_ALL_TIME, periodLabel: "across all your history" };
  }
}

/**
 * Reads a month the model named, as `YYYY-MM` or by name ("September", "Sept 2025"). A name with
 * no year means its most recent occurrence, so in October "September" is last month and
 * "November" is last year's. Returns null when it isn't a month.
 */
function parseRequestedMonth(
  requestedMonth: string,
  today: Date
): { year: number; monthIndex: number } | null {
  const numericMatch = MONTH_PATTERN.exec(requestedMonth);
  if (numericMatch) {
    const monthIndex = Number(numericMatch[2]) - 1;
    return monthIndex >= 0 && monthIndex <= 11
      ? { year: Number(numericMatch[1]), monthIndex }
      : null;
  }
  const namedMatch = NAMED_MONTH_PATTERN.exec(requestedMonth.trim());
  if (!namedMatch) return null;
  const monthIndex = MONTH_NAMES.findIndex((monthName) =>
    monthName.startsWith(namedMatch[1]!.toLowerCase())
  );
  if (monthIndex < 0) return null;
  if (namedMatch[2]) return { year: Number(namedMatch[2]), monthIndex };
  const isLaterThisYear = monthIndex > today.getUTCMonth();
  return { year: today.getUTCFullYear() - (isLaterThisYear ? 1 : 0), monthIndex };
}

/** The named period a question asks about in its own words, e.g. "this year", or null. */
function detectQuestionPeriod(question: string): SpendingPeriod | null {
  return QUESTION_PERIOD_PATTERNS.find(([, pattern]) => pattern.test(question))?.[0] ?? null;
}

/** Whether a question names a month, by its name or the first three letters of it. */
function namesMonth(question: string, monthIndex: number): boolean {
  return new RegExp(`\\b${MONTH_NAMES[monthIndex]!.slice(0, 3)}`, "i").test(question);
}

/** Resolves one month to its bounds, or says why it can't be added up. */
function resolveMonth(
  { year, monthIndex }: { year: number; monthIndex: number },
  today: Date
): ResolvedPeriod | { reply: string } {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  if (start > today) {
    return { reply: `${describeMonth(year, monthIndex)} hasn't happened yet.` };
  }
  return {
    start,
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
    periodLabel: `in ${describeMonth(year, monthIndex)}`,
    periodArgument: { month: `${year}-${String(monthIndex + 1).padStart(2, "0")}` },
  };
}

/**
 * Works out the period to add up. The model often leaves out a period the user typed ("this
 * year"), so the question's own words win over the model's — except over a month the question also
 * names, which is the more specific of the two. With nothing named, the question is taken to be
 * about this month, and the answer says so.
 */
function resolvePeriod(
  toolArguments: Record<string, unknown>,
  question: string,
  today: Date
): ResolvedPeriod | { reply: string } {
  const requestedMonth = readTextArgument(toolArguments.month, MAX_CATEGORY_LENGTH);
  const month = requestedMonth === null ? null : parseRequestedMonth(requestedMonth, today);
  const questionPeriod = detectQuestionPeriod(question);
  if (month && (!questionPeriod || namesMonth(question, month.monthIndex))) {
    return resolveMonth(month, today);
  }
  if (requestedMonth !== null && !month && !questionPeriod) {
    return { reply: "Which month do you mean? For example, September 2026." };
  }
  const requestedPeriod = readTextArgument(toolArguments.period, MAX_CATEGORY_LENGTH);
  const period =
    questionPeriod ??
    SPENDING_PERIODS.find((candidate) => candidate === requestedPeriod?.toLowerCase()) ??
    "this month";
  return { ...resolveNamedPeriod(period, today), periodArgument: { period } };
}

/** Whether a message mentions a category by its name or its singular, e.g. "grocery". */
function mentionsCategory(message: string, category: string): boolean {
  const singularCategory = category.replace(/ies$/i, "y").replace(/s$/i, "");
  return mentionsPhrase(message, category) || mentionsPhrase(message, singularCategory);
}

/** Keeps only the arguments the lookup reads, as strings, for storing with the reply. */
function toStoredArguments(toolArguments: Record<string, unknown>): SpendingLookupArguments {
  const storedArguments: Record<string, string> = {};
  for (const name of ["merchant", "category", "period", "month"]) {
    const value = readTextArgument(toolArguments[name], MAX_MERCHANT_LENGTH);
    if (value !== null) storedArguments[name] = value;
  }
  return storedArguments as SpendingLookupArguments;
}

/**
 * Reads the model's arguments into a spending query. A merchant must be one the user named — a
 * small model otherwise swaps in a guess (asked about "coffee", it picked a coffee chain) and the
 * answer would quietly be about the wrong store. A category must be one of the user's own, and one
 * they mentioned: the model also adds a category to a store question ("Costco" became Costco on
 * Groceries), which is dropped, and on its own an unmentioned category is asked about instead.
 */
export function interpretSpendingLookup(
  toolArguments: Record<string, unknown>,
  { referenceData, today, question, earlierUserMessages }: ToolCallContext
): SpendingLookupInterpretation {
  const sentArguments = toStoredArguments(toolArguments);
  /** Puts a question back to the user, storing the arguments as the model sent them. */
  const askBack = (reply: string): SpendingLookupInterpretation => ({
    query: null,
    reply,
    lookupArguments: sentArguments,
  });
  const userMessages = [question, ...earlierUserMessages];

  const merchant = readTextArgument(toolArguments.merchant, MAX_MERCHANT_LENGTH);
  if (merchant && !userMessages.some((userMessage) => mentionsPhrase(userMessage, merchant))) {
    return askBack("Which store do you mean? Tell me its name as it shows on your transactions.");
  }

  const requestedCategory = readTextArgument(toolArguments.category, MAX_CATEGORY_LENGTH);
  const matchedCategory = requestedCategory
    ? findMatchingName(referenceData.expenseCategoryNames, requestedCategory)
    : null;
  const yourCategories = `Yours are: ${referenceData.expenseCategoryNames.join(", ")}.`;
  if (requestedCategory && !matchedCategory) {
    return askBack(
      `"${requestedCategory}" isn't one of your spending categories. ${yourCategories}`
    );
  }
  const isCategoryMentioned =
    matchedCategory !== null &&
    userMessages.some((userMessage) => mentionsCategory(userMessage, matchedCategory));
  if (matchedCategory && !isCategoryMentioned && !merchant) {
    return askBack(`Which of your spending categories do you mean? ${yourCategories}`);
  }
  const category = isCategoryMentioned ? matchedCategory : null;

  const period = resolvePeriod(toolArguments, question, today);
  if ("reply" in period) return askBack(period.reply);
  const { periodArgument, ...periodBounds } = period;
  return {
    query: { merchant, category, ...periodBounds },
    reply: null,
    lookupArguments: {
      ...(merchant ? { merchant } : {}),
      ...(category ? { category } : {}),
      ...periodArgument,
    },
  };
}

/**
 * Replays a stored spending answer as the lookup call it came from, followed by its result. Shown
 * as plain text instead, the model copies the answer's wording on later questions and makes the
 * figures up rather than calling the lookup again.
 */
export function toSpendingLookupModelMessages(
  content: string,
  lookupArguments: SpendingLookupArguments
): OllamaChatMessage[] {
  return [
    {
      role: "assistant",
      content: "",
      tool_calls: [{ function: { name: LOOK_UP_SPENDING_TOOL_NAME, arguments: lookupArguments } }],
    },
    { role: "tool", content },
    { role: "assistant", content },
  ];
}

/** Names what was added up, e.g. "at Tim Hortons", "on Dining", or both. */
function describeSubject({ merchant, category }: SpendingLookupQuery): string {
  return [merchant ? `at ${merchant}` : null, category ? `on ${category}` : null]
    .filter(Boolean)
    .join(" ");
}

/**
 * Words the answer to a spending question from what the lookup found. The answer always names the
 * merchant, category, and period it covers, so the user can tell if the question was misread.
 */
export function formatSpendingAnswer(
  query: SpendingLookupQuery,
  result: SpendingLookupResult
): string {
  const subject = describeSubject(query);
  const subjectAndPeriod = [subject, query.periodLabel].filter(Boolean).join(" ");
  if (result.purchaseCount === 0) {
    return (
      `I couldn't find any spending ${subjectAndPeriod}.` +
      (query.merchant ? " If the name looks different on your statement, try that spelling." : "")
    );
  }
  const purchaseWord = result.purchaseCount === 1 ? "purchase" : "purchases";
  const answer =
    `You spent ${formatDollars(result.total)} ${subjectAndPeriod}, across ` +
    `${result.purchaseCount} ${purchaseWord}.`;
  const largestPurchase = result.largestPurchase;
  if (result.purchaseCount === 1 || !largestPurchase) return answer;
  const largestPlace =
    !query.merchant && largestPurchase.label ? ` at ${largestPurchase.label}` : "";
  return (
    `${answer} The largest was ${formatDollars(largestPurchase.amount)}${largestPlace} on ` +
    `${formatPurchaseDay(largestPurchase.effectiveAt)}.`
  );
}

/** Describes the spending lookup to the model, with the user's own categories as the only choices. */
export function buildSpendingLookupTool(
  referenceData: ChatActionReferenceData
): OllamaToolDefinition {
  return {
    type: "function",
    function: {
      name: LOOK_UP_SPENDING_TOOL_NAME,
      description:
        "Add up how much the user spent, from their real transactions. Use it for any question " +
        "about how much they spent at a store, on a category, or over a period.",
      parameters: {
        type: "object",
        properties: {
          merchant: {
            type: "string",
            description: "Store the user named, e.g. Tim Hortons. Leave out unless they named one.",
          },
          category: {
            type: "string",
            ...(referenceData.expenseCategoryNames.length > 0
              ? { enum: referenceData.expenseCategoryNames }
              : {}),
            description: "Spending category. Leave out unless the user named one.",
          },
          period: {
            type: "string",
            enum: [...SPENDING_PERIODS],
            description: "Leave out to mean this month.",
          },
          month: {
            type: "string",
            description: "A specific month the user named, as YYYY-MM. Leave out otherwise.",
          },
        },
        required: [],
      },
    },
  };
}

/** The system-prompt line that sends spending questions to the lookup instead of a guess. */
export const SPENDING_LOOKUP_INSTRUCTIONS =
  `SPENDING: when the user asks how much they spent — at a store, on a category, or over a ` +
  `period — call ${LOOK_UP_SPENDING_TOOL_NAME} instead of estimating. Fill in only the store, ` +
  `category, and period the user named.`;
