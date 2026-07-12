/** Display metadata for each transaction type: a human label and whether it adds money to an account. */
export const TRANSACTION_TYPE_META: Record<string, { label: string; isInflow: boolean }> = {
  DEPOSIT: { label: "Deposit", isInflow: true },
  WITHDRAWAL: { label: "Withdrawal", isInflow: false },
  TRANSFER_IN: { label: "Transfer In", isInflow: true },
  TRANSFER_OUT: { label: "Transfer Out", isInflow: false },
};

/** The transaction types offered as filter options, in the order they appear in the dropdown. */
export const TRANSACTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "DEPOSIT", label: "Deposit" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
  { value: "TRANSFER_IN", label: "Transfer In" },
  { value: "TRANSFER_OUT", label: "Transfer Out" },
];
