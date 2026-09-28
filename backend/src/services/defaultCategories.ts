import type { CategoryType } from "@prisma/client";

/** The starter category a new user sees before they customize anything. */
export type DefaultCategory = {
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
};

/**
 * Seeded the first time a user's category list is read. Mirrors the categories
 * Bloom already used as hardcoded constants, so existing transactions/budgets/
 * rules that reference these names by string still match a real category.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Groceries", type: "EXPENSE", color: "#22c55e", icon: "🛒" },
  { name: "Rent", type: "EXPENSE", color: "#f97316", icon: "🏠" },
  { name: "Utilities", type: "EXPENSE", color: "#0ea5e9", icon: "💡" },
  { name: "Transport", type: "EXPENSE", color: "#6366f1", icon: "🚌" },
  { name: "Dining", type: "EXPENSE", color: "#ef4444", icon: "🍽️" },
  { name: "Shopping", type: "EXPENSE", color: "#ec4899", icon: "🛍️" },
  { name: "Healthcare", type: "EXPENSE", color: "#14b8a6", icon: "🩺" },
  { name: "Entertainment", type: "EXPENSE", color: "#a855f7", icon: "🎬" },
  { name: "Other", type: "EXPENSE", color: "#64748b", icon: "📦" },
  { name: "Salary", type: "INCOME", color: "#22c55e", icon: "💼" },
  { name: "Freelance", type: "INCOME", color: "#0ea5e9", icon: "💻" },
  { name: "Gift", type: "INCOME", color: "#ec4899", icon: "🎁" },
  { name: "Investment", type: "INCOME", color: "#a855f7", icon: "📈" },
  { name: "Other Income", type: "INCOME", color: "#64748b", icon: "💰" },
];
