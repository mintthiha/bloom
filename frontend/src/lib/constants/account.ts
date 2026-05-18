export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Gift",
  "Investment",
  "Other Income",
];

export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Dining",
  "Shopping",
  "Healthcare",
  "Entertainment",
  "Other",
];

export const TRANSACTION_FILTER_CATEGORIES = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  "Transfer",
];

export const ACCOUNT_TYPE_META = {
  CHEQUING: { label: "Chequing", color: "#f59e0b" },
  SAVINGS: { label: "Savings", color: "#22c55e" },
  TFSA: { label: "TFSA", color: "#38bdf8" },
  RRSP: { label: "RRSP", color: "#a78bfa" },
  FHSA: { label: "FHSA", color: "#fb7185" },
  CREDIT: { label: "Credit", color: "#ef4444" },
} as const;
