import { UserDataExport } from "@/lib/api";

/** One line of the "what's in your export" summary shown after a download. */
export type UserDataSummaryRow = {
  label: string;
  count: number;
};

/** How each export section is counted and named, in the order it reads best to a person. */
const SUMMARY_SECTIONS: Array<{
  singularLabel: string;
  pluralLabel: string;
  countOf: (data: UserDataExport) => number;
}> = [
  { singularLabel: "account", pluralLabel: "accounts", countOf: (data) => data.accounts.length },
  {
    singularLabel: "transaction",
    pluralLabel: "transactions",
    countOf: (data) => data.transactions.length,
  },
  { singularLabel: "budget", pluralLabel: "budgets", countOf: (data) => data.budgets.length },
  {
    singularLabel: "savings goal",
    pluralLabel: "savings goals",
    countOf: (data) => data.savingsGoals.length,
  },
  {
    singularLabel: "recurring payment",
    pluralLabel: "recurring payments",
    countOf: (data) => data.recurringTransactions.length,
  },
  {
    singularLabel: "manual asset or debt",
    pluralLabel: "manual assets and debts",
    countOf: (data) => data.manualEntries.length,
  },
  {
    singularLabel: "category rule",
    pluralLabel: "category rules",
    countOf: (data) => data.categorizationRules.length,
  },
  {
    singularLabel: "net worth snapshot",
    pluralLabel: "net worth snapshots",
    countOf: (data) => data.netWorthSnapshots.length,
  },
];

/** Serializes the export bundle as indented JSON so the downloaded file is readable by a person. */
export function buildUserDataJson(data: UserDataExport): string {
  return JSON.stringify(data, null, 2);
}

/** Returns a dated filename for the whole-account export, e.g. `bloom-my-data-2026-09-26.json`. */
export function buildUserDataExportFilename(extension: "json", now: Date = new Date()): string {
  return `bloom-my-data-${now.toISOString().slice(0, 10)}.${extension}`;
}

/**
 * Counts what the export actually contains, so the panel can promise something concrete
 * ("312 transactions") instead of a vague "all your data". Sections with nothing in them
 * are left out rather than listed as zero.
 */
export function summarizeUserDataExport(data: UserDataExport): UserDataSummaryRow[] {
  return SUMMARY_SECTIONS.map((section) => {
    const count = section.countOf(data);
    return { label: count === 1 ? section.singularLabel : section.pluralLabel, count };
  }).filter((row) => row.count > 0);
}

/**
 * Turns the export summary into one human sentence for the success toast, so the user can
 * tell at a glance that the file really holds their data.
 */
export function describeUserDataExport(data: UserDataExport): string {
  const rows = summarizeUserDataExport(data);
  if (rows.length === 0) return "Your account has no data yet";
  return rows.map((row) => `${row.count} ${row.label}`).join(" · ");
}
