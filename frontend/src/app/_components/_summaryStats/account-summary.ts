import type { Account, ManualEntry } from "@/lib/api";

const REGISTERED_ACCOUNT_TYPES = new Set(["TFSA", "RRSP", "FHSA"]);

/** The account groupings and totals behind the dashboard's summary row. */
export type AccountSummary = {
  cashAccounts: Account[];
  creditAccounts: Account[];
  chequingAccounts: Account[];
  savingsAccounts: Account[];
  registeredAccounts: Account[];
  totalCash: number;
  totalCredit: number;
  netWorth: number;
};

/**
 * Groups accounts for the summary row and computes net worth: every non-credit balance plus
 * manual assets, minus credit balances owed and manual liabilities.
 */
export function summarizeAccounts(
  accounts: Account[],
  manualEntries: ManualEntry[]
): AccountSummary {
  const cashAccounts = accounts.filter((account) => account.accountType !== "CREDIT");
  const creditAccounts = accounts.filter((account) => account.accountType === "CREDIT");
  const totalCash = cashAccounts.reduce((sum, account) => sum + account.balance, 0);
  const totalCredit = creditAccounts.reduce((sum, account) => sum + account.balance, 0);
  const manualAssets = manualEntries
    .filter((entry) => entry.type === "ASSET")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const manualLiabilities = manualEntries
    .filter((entry) => entry.type === "LIABILITY")
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    cashAccounts,
    creditAccounts,
    chequingAccounts: accounts.filter((account) => account.accountType === "CHEQUING"),
    savingsAccounts: accounts.filter((account) => account.accountType === "SAVINGS"),
    registeredAccounts: accounts.filter((account) =>
      REGISTERED_ACCOUNT_TYPES.has(account.accountType)
    ),
    totalCash,
    totalCredit,
    netWorth: totalCash + manualAssets - totalCredit - manualLiabilities,
  };
}
