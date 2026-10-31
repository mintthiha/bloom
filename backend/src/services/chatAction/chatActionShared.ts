// Tool names, limits, fixed replies, and the argument-reading helpers every interpreter shares.
// Split out of chatActionProposals.ts, which re-exports its public API.
import { requireString } from "../../lib/validation";
import type {
  ProposedChatActionStatus,
  ChatActionReferenceData,
  ToolCallInterpretation,
} from "./chatActionTypes";

export const PROPOSE_BUDGET_TOOL_NAME = "propose_budget";
export const PROPOSE_SAVINGS_GOAL_TOOL_NAME = "propose_savings_goal";
export const PROPOSE_SAVINGS_GOAL_CHANGE_TOOL_NAME = "propose_savings_goal_change";
export const PROPOSE_CATEGORIZATION_RULE_TOOL_NAME = "propose_categorization_rule";
export const PROPOSE_DELETION_TOOL_NAME = "propose_deletion";
export const EXPLAIN_UNSUPPORTED_REQUEST_TOOL_NAME = "explain_unsupported_request";

/** How the deletion tool names each kind of thing it can delete, for the model and the user. */
export const DELETABLE_ITEM_TYPES = {
  budget: "budget",
  savingsGoal: "savings goal",
  categorizationRule: "categorization rule",
} as const;

// The same length limits the budget, savings goal, and categorization rule routes enforce.
export const MAX_CATEGORY_LENGTH = 50;
export const MAX_GOAL_NAME_LENGTH = 100;
export const MAX_MERCHANT_LENGTH = 100;
export const MAX_ACCOUNT_REFERENCE_LENGTH = 200;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHEQUING: "Chequing",
  SAVINGS: "Savings",
  TFSA: "TFSA",
  RRSP: "RRSP",
  FHSA: "FHSA",
  CREDIT: "Credit",
};

/** What the model is told became of a draft it made earlier in the conversation. */
export const PROPOSAL_OUTCOME_BY_STATUS: Record<ProposedChatActionStatus, string> = {
  PENDING:
    "Shown to the user as a card. They have not confirmed or dismissed it yet, so nothing is saved.",
  CONFIRMED: "The user confirmed this draft and it was carried out.",
  DISMISSED: "The user dismissed this draft. Nothing was changed.",
};

/** Closes every line that introduces a draft, so the user knows the card still needs them. */
export const REVIEW_REMINDER = "Review it below — nothing is saved until you confirm.";

/** Closes every line that introduces a drafted deletion. */
export const DELETION_REVIEW_REMINDER = "Review it below — nothing is deleted until you confirm.";

// A number the way a user types an amount: optional thousands separators and decimals, and an
// optional "k" for thousands ("3k", "1.5k").
const STATED_AMOUNT_PATTERN = /(\d[\d,]*(?:\.\d+)?)\s?(k(?![a-z]))?/gi;

export const UNKNOWN_TOOL_REPLY =
  "I couldn't turn that into something I can save. I can draft a budget, a savings goal, or a " +
  "categorization rule for you to confirm.";

export const DELETION_LIMITS_REPLY =
  "I can delete a budget, a savings goal, or a categorization rule. Transactions, accounts, and " +
  "anything else have to be deleted from their own page in Bloom.";

/** Closes every refusal by saying what the chat can do instead. */
export const CHAT_CAPABILITIES =
  "From the chat I can draft budgets, savings goals, and categorization rules, change them, or " +
  "delete them.";

/**
 * What the chat says when asked for a change it can't make, keyed by the kind of request the
 * model reports. Fixed wording, so the reply always names the page that really does it.
 */
export const UNSUPPORTED_REQUEST_REPLIES = {
  account:
    "I can't open or delete accounts from the chat. You can open a new account from the " +
    "Overview page, or delete one from that account's own page.",
  transaction:
    "I can't add, import, edit, or delete transactions from the chat. You can do that on the " +
    "account's own page — open it from Accounts.",
  transfer:
    "I can't record a transfer from the chat. You can record it on the account's own page — " +
    "open it from Accounts.",
  category:
    "I can't add or change categories from the chat. You can do that on the Categories page.",
  subscription:
    "I can't change subscriptions from the chat. The Subscriptions page shows the recurring " +
    "payments Bloom has detected; to cancel one, contact the company that bills you.",
  setting: "I can't change settings from the chat. You can change them on the Settings page.",
  other: "I can't do that from the chat.",
} as const;

export type UnsupportedRequestKind = keyof typeof UNSUPPORTED_REQUEST_REPLIES;

/** Renders a date as the `YYYY-MM-DD` day it falls on in UTC. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Lowercases and collapses spacing so a name the model typed can be compared with a stored one. */
export function toComparableText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Names an account the way the model and the user see it, e.g. "Rainy day (Savings)". */
export function describeAccount(account: ChatActionReferenceData["accounts"][number]): string {
  return `${account.name} (${ACCOUNT_TYPE_LABELS[account.accountType] ?? account.accountType})`;
}

/**
 * Reads a text argument with the same cleanup the HTTP routes apply to typed input. Returns null
 * when the model left it out, sent something that is not text, or sent more than `maxLength`.
 */
export function readTextArgument(value: unknown, maxLength: number): string | null {
  try {
    return requireString(value, "argument", { max: maxLength });
  } catch {
    return null;
  }
}

/** Rounds a dollar amount to whole cents. */
function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Collects every number the user typed, so an amount from the model can be checked against them. */
export function extractStatedAmounts(userMessages: string[]): number[] {
  return userMessages.flatMap((userMessage) =>
    [...userMessage.matchAll(STATED_AMOUNT_PATTERN)].map(([, digits, thousandsSuffix]) =>
      roundToCents(Number(digits!.replace(/,/g, "")) * (thousandsSuffix ? 1000 : 1))
    )
  );
}

/**
 * Reads a dollar amount, rounded to cents. Small models often send numbers as text ("400",
 * "$1,200"), so those are accepted too. Returns null for anything that is not a positive amount —
 * and for an amount the user never typed: asked for a budget or goal without one, the model
 * tends to fill it in with a guess (such as a balance from the user's snapshot) rather than ask.
 */
export function readAmountArgument(value: unknown, statedAmounts: number[]): number | null {
  const amount = typeof value === "string" ? Number(value.replace(/[$,\s]/g, "")) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const amountRoundedToCents = roundToCents(amount);
  if (amountRoundedToCents <= 0 || !statedAmounts.includes(amountRoundedToCents)) return null;
  return amountRoundedToCents;
}

/** Whether a text mentions a phrase as whole words, ignoring case and spacing. */
export function mentionsPhrase(text: string, phrase: string): boolean {
  const comparablePhrase = toComparableText(phrase);
  if (!comparablePhrase) return false;
  const escapedPhrase = comparablePhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escapedPhrase}(?![a-z0-9])`).test(toComparableText(text));
}

/** Finds the stored name that matches what the model typed, ignoring case and spacing. */
export function findMatchingName(names: string[], requestedName: string): string | null {
  const comparableRequestedName = toComparableText(requestedName);
  return names.find((name) => toComparableText(name) === comparableRequestedName) ?? null;
}

/** Wraps a line for the user that explains why no draft was made. */
export function withoutProposal(reply: string): ToolCallInterpretation {
  return { proposedAction: null, reply };
}

// The kinds of change the chat can't make, as the user tends to word them, checked in order:
// "add a transaction to my Everyday account" is about a transaction, not the account.
const UNSUPPORTED_REQUEST_PATTERNS: [UnsupportedRequestKind, RegExp][] = [
  ["transfer", /\btransfer/i],
  ["subscription", /\bsubscriptions?\b/i],
  ["transaction", /\b(transactions?|purchases?|expenses?|charges?)\b/i],
  ["category", /\bcategor(y|ies)\b/i],
  ["account", /\baccounts?\b|\b(tfsa|rrsp|fhsa|chequing|credit card)\b/i],
  ["setting", /\b(settings?|profile|password|currency|theme|dark mode)\b/i],
];

/** Names the kind of change the chat can't make that a request is about, if it is one. */
export function detectUnsupportedRequestKind(question: string): UnsupportedRequestKind | null {
  return UNSUPPORTED_REQUEST_PATTERNS.find(([, pattern]) => pattern.test(question))?.[0] ?? null;
}
