// Accounts and their transactions: lifecycle, money movement, transaction edits, analytics, and CSV import.
// The implementation lives in ./account/; this file keeps the original import path stable
// for routes, other services, and test mocks.
export type { TransactionSplitInput, RecurringActivitySource } from "./account/accountRecords";
export {
  getMonthlySummary,
  getCategoryBreakdown,
  getMonthlyTrends,
  recordNetWorthSnapshot,
  getNetWorthHistory,
} from "./account/accountAnalytics";
export {
  listAccounts,
  createAccount,
  getAccount,
  updateNickname,
  updateAccountAppearance,
  freezeAccount,
  unfreezeAccount,
  deleteAccount,
  restoreAccount,
} from "./account/accountLifecycle";
export { deposit, withdraw, transfer } from "./account/accountMoneyMovement";
export {
  getTransactions,
  setTransactionSplits,
  clearTransactionSplits,
  recordReceiptPurchase,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
} from "./account/accountTransactions";
export type { ReceiptPurchaseInput } from "./account/accountTransactions";
export { importTransactions } from "./account/accountImport";
export type { ImportRow } from "./account/accountImport";
