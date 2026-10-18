import { formatCurrency } from "@/lib/format";
import { SafeToSpendResult } from "@/lib/safe-to-spend";

/** Bills listed by name in the question; the rest are summarised so a busy month stays short. */
export const MAX_BILLS_IN_PROMPT = 5;

/** Renders a YYYY-MM-DD bill date as a short month and day ("Oct 31"). */
function formatBillDate(dateOnly: string): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

/** Builds the chat question for the safe-to-spend card, carrying the ledger behind the figure. */
export function buildSafeToSpendPrompt(result: SafeToSpendResult): string {
  const safeToSpend = formatCurrency(result.safeToSpend);
  const isPositive = result.safeToSpend > 0;
  const daysLabel = `${result.daysRemaining} day${result.daysRemaining !== 1 ? "s" : ""}`;

  const question = isPositive
    ? `Why is my safe-to-spend ${safeToSpend} for the rest of the month, and how can I make it go further?`
    : `Why is my safe-to-spend ${safeToSpend} for the rest of the month, and what should I do about it?`;

  const ledgerLines = [
    "Here's how Bloom works it out:",
    `- Available cash in chequing and savings: ${formatCurrency(result.availableCash)}`,
  ];
  if (result.expectedIncome > 0) {
    ledgerLines.push(
      `- Expected income before month-end: ${formatCurrency(result.expectedIncome)}`
    );
  }
  ledgerLines.push(`- Bills still due before month-end: ${formatCurrency(result.upcomingBills)}`);
  ledgerLines.push(
    isPositive
      ? `- Safe to spend: ${safeToSpend}, about ${formatCurrency(result.perDay)} a day for the ${daysLabel} left`
      : `- Safe to spend: ${safeToSpend}, with ${daysLabel} left this month`
  );

  const sections = [question, ledgerLines.join("\n")];

  if (result.billItems.length > 0) {
    const listedBills = result.billItems.slice(0, MAX_BILLS_IN_PROMPT);
    const unlistedBillCount = result.billItems.length - listedBills.length;
    const billLines = listedBills.map(
      (bill) => `- ${bill.label}: ${formatCurrency(bill.amount)} on ${formatBillDate(bill.date)}`
    );
    if (unlistedBillCount > 0) {
      billLines.push(`- plus ${unlistedBillCount} more bill${unlistedBillCount !== 1 ? "s" : ""}`);
    }
    sections.push(["Bills still due:", ...billLines].join("\n"));
  }

  return sections.join("\n\n");
}
