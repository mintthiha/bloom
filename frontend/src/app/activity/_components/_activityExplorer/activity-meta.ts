import { ActivityActionKey, ActivityGroupKey, ActivitySortKey } from "@/lib/api";

/** Per-type display metadata: a human label, an accent colour, and a compact glyph. */
export const ACTIVITY_META: Record<string, { label: string; color: string; icon: string }> = {
  ACCOUNT_CREATED: { label: "Account created", color: "#22c55e", icon: "+" },
  ACCOUNT_DELETED: { label: "Account deleted", color: "#f87171", icon: "×" },
  ACCOUNT_RESTORED: { label: "Account restored", color: "#34d399", icon: "↺" },
  ACCOUNT_FROZEN: { label: "Account frozen", color: "#60a5fa", icon: "❄" },
  ACCOUNT_UNFROZEN: { label: "Account unfrozen", color: "#34d399", icon: "✓" },
  ACCOUNT_RENAMED: { label: "Account renamed", color: "#a78bfa", icon: "✎" },
  ACCOUNT_RESYNCED: { label: "Account re-synced", color: "#38bdf8", icon: "↻" },
  TRANSACTION_DEPOSIT: { label: "Deposit", color: "#22c55e", icon: "↓" },
  TRANSACTION_WITHDRAWAL: { label: "Withdrawal", color: "#f87171", icon: "↑" },
  TRANSACTION_TRANSFER: { label: "Transfer", color: "#fb923c", icon: "→" },
  TRANSACTION_DELETED: { label: "Transaction deleted", color: "#f87171", icon: "×" },
  TRANSACTION_RESTORED: { label: "Transaction restored", color: "#34d399", icon: "↺" },
  TRANSACTION_UPDATED: { label: "Transaction edited", color: "#a78bfa", icon: "✎" },
  TRANSACTION_IMPORTED: { label: "Import", color: "#34d399", icon: "↧" },
  GOAL_CREATED: { label: "Goal created", color: "#22c55e", icon: "★" },
  GOAL_UPDATED: { label: "Goal updated", color: "#a78bfa", icon: "✎" },
  GOAL_DELETED: { label: "Goal deleted", color: "#f87171", icon: "×" },
  GOAL_RESTORED: { label: "Goal restored", color: "#34d399", icon: "↺" },
  BUDGET_CREATED: { label: "Budget created", color: "#22c55e", icon: "$" },
  BUDGET_UPDATED: { label: "Budget updated", color: "#a78bfa", icon: "✎" },
  BUDGET_DELETED: { label: "Budget deleted", color: "#f87171", icon: "×" },
  BUDGET_RESTORED: { label: "Budget restored", color: "#34d399", icon: "↺" },
  RECURRING_CREATED: { label: "Recurring created", color: "#22c55e", icon: "↻" },
  RECURRING_UPDATED: { label: "Recurring updated", color: "#a78bfa", icon: "✎" },
  RECURRING_PAUSED: { label: "Recurring paused", color: "#60a5fa", icon: "❚❚" },
  RECURRING_RESUMED: { label: "Recurring resumed", color: "#34d399", icon: "▶" },
  RECURRING_DELETED: { label: "Recurring deleted", color: "#f87171", icon: "×" },
  RECURRING_RESTORED: { label: "Recurring restored", color: "#34d399", icon: "↺" },
  MANUAL_ENTRY_CREATED: { label: "Entry added", color: "#22c55e", icon: "+" },
  MANUAL_ENTRY_UPDATED: { label: "Entry updated", color: "#a78bfa", icon: "✎" },
  MANUAL_ENTRY_DELETED: { label: "Entry removed", color: "#f87171", icon: "×" },
  MANUAL_ENTRY_RESTORED: { label: "Entry restored", color: "#34d399", icon: "↺" },
  CATEGORIZATION_RULE_CREATED: { label: "Rule created", color: "#22c55e", icon: "+" },
  CATEGORIZATION_RULE_UPDATED: { label: "Rule updated", color: "#a78bfa", icon: "✎" },
  CATEGORIZATION_RULE_DELETED: { label: "Rule deleted", color: "#f87171", icon: "×" },
  CATEGORIZATION_RULE_RESTORED: { label: "Rule restored", color: "#34d399", icon: "↺" },
  PROFILE_UPDATED: { label: "Profile updated", color: "#a78bfa", icon: "✎" },
  PROFILE_REMINDERS_UPDATED: { label: "Reminder preferences updated", color: "#a78bfa", icon: "✎" },
};

/** Returns display metadata for an activity type, falling back to a generic entry. */
export function activityMeta(type: string) {
  return ACTIVITY_META[type] ?? { label: type, color: "var(--text-secondary)", icon: "•" };
}

/** Group filter options shown in the dropdown, mapped to the API group keys. */
export const ACTIVITY_GROUP_OPTIONS: { value: ActivityGroupKey; label: string }[] = [
  { value: "ACCOUNT", label: "Accounts" },
  { value: "TRANSACTION", label: "Transactions" },
  { value: "GOAL", label: "Goals" },
  { value: "BUDGET", label: "Budgets" },
  { value: "RECURRING", label: "Recurring" },
  { value: "MANUAL_ENTRY", label: "Manual entries" },
  { value: "CATEGORIZATION_RULE", label: "Categorization rules" },
  { value: "PROFILE", label: "Profile" },
];

/**
 * Action filter options shown in the dropdown, mapped to the API action keys. Standalone
 * events (freezes, renames, withdrawals, transfers) match none of these.
 */
export const ACTIVITY_ACTION_OPTIONS: { value: ActivityActionKey; label: string }[] = [
  { value: "CREATED", label: "Created" },
  { value: "UPDATED", label: "Updated" },
  { value: "DELETED", label: "Deleted" },
  { value: "RESTORED", label: "Restored" },
  { value: "RESYNCED", label: "Re-synced" },
  { value: "PAUSED", label: "Paused" },
  { value: "RESUMED", label: "Resumed" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "IMPORTED", label: "Import" },
];

/** Sort options shown in the dropdown, mapped to the API sort keys. */
export const ACTIVITY_SORT_OPTIONS: { value: ActivitySortKey; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
];
