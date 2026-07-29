import {
  FHSA_ANNUAL_LIMIT,
  FHSA_LIFETIME_LIMIT,
  getTfsaAnnualLimit,
} from "@/lib/contribution-room";

/** Formats a whole-dollar statutory limit without cents, e.g. 7000 -> "$7,000". */
function formatLimit(amount: number): string {
  return `$${amount.toLocaleString("en-CA")}`;
}

/**
 * Authoritative Canadian contribution limits drawn from Bloom's own CRA figures, injected into the
 * chat so the model states real numbers instead of guessing from stale training data.
 * `referenceDate` is injectable to keep the output deterministic under test.
 */
export function buildCanadianTaxFacts(referenceDate: Date = new Date()): string {
  const year = referenceDate.getFullYear();
  const lines: string[] = [];

  const tfsaLimit = getTfsaAnnualLimit(year);
  if (tfsaLimit != null) {
    lines.push(`- TFSA annual contribution limit for ${year}: ${formatLimit(tfsaLimit)}.`);
  }
  lines.push(
    `- FHSA contribution limit: ${formatLimit(FHSA_ANNUAL_LIMIT)} per year, ` +
      `${formatLimit(FHSA_LIFETIME_LIMIT)} lifetime.`
  );

  return [
    `AUTHORITATIVE CANADIAN FIGURES — use these exact numbers and do not rely on your own memory ` +
      `for contribution limits. If the user asks for a figure that isn't listed here, say you're ` +
      `not certain rather than guessing:`,
    ...lines,
  ].join("\n");
}
