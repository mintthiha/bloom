export const INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Investment", "Other Income"];

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
  CHEQUING: { label: "Chequing", color: "#3b82f6", soft: "#3b82f622", border: "#3b82f644" },
  SAVINGS: { label: "Savings", color: "#22c55e", soft: "#16a34a22", border: "#16a34a44" },
  TFSA: { label: "TFSA", color: "#38bdf8", soft: "#0ea5e922", border: "#0ea5e944" },
  RRSP: { label: "RRSP", color: "#a78bfa", soft: "#8b5cf622", border: "#8b5cf644" },
  FHSA: { label: "FHSA", color: "#fb7185", soft: "#f43f5e22", border: "#f43f5e44" },
  CREDIT: { label: "Credit", color: "#ef4444", soft: "#ef444422", border: "#ef444444" },
} as const;
