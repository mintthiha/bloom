import type { AccountType, AutoCategorizationRule, QuickAddDraft } from "@/lib/api";

/** The form operations a quick-add draft can fill in. */
export type QuickAddOperation = "deposit" | "withdraw";

/** What a quick-add draft puts into the new-transaction form's fields. */
export type QuickAddFormValues = {
  op: QuickAddOperation;
  amount: string;
  merchant: string;
  category: string;
  date: string;
};

/** Everything about the account and the user that decides how a draft lands in the form. */
export type QuickAddFormContext = {
  accountType: AccountType;
  categorizationRules: AutoCategorizationRule[];
  incomeCategoryNames: string[];
  expenseCategoryNames: string[];
};

/**
 * Picks the form operation for money going out or coming in. On a credit card the form's
 * "deposit" is a charge and its "withdraw" a payment, so the mapping flips there.
 */
function toOperation(direction: QuickAddDraft["direction"], accountType: AccountType) {
  const isMoneyOut = direction === "EXPENSE";
  if (accountType === "CREDIT") return isMoneyOut ? "deposit" : "withdraw";
  return isMoneyOut ? "withdraw" : "deposit";
}

/**
 * Turns a draft into the form's field values. A categorization rule for the merchant wins over the
 * model's category, the same way typing that merchant into the form would, and a category the
 * chosen operation doesn't offer is left blank rather than shown as a value the select can't hold.
 */
export function toQuickAddFormValues(
  draft: QuickAddDraft,
  {
    accountType,
    categorizationRules,
    incomeCategoryNames,
    expenseCategoryNames,
  }: QuickAddFormContext
): QuickAddFormValues {
  const op = toOperation(draft.direction, accountType);
  const offeredCategories =
    op === "deposit" && accountType !== "CREDIT" ? incomeCategoryNames : expenseCategoryNames;
  const merchant = draft.merchant ?? "";
  const ruleCategory = merchant
    ? categorizationRules.find((rule) => rule.merchant.toLowerCase() === merchant.toLowerCase())
        ?.category
    : undefined;
  const category = ruleCategory ?? draft.category ?? "";
  return {
    op,
    amount: draft.amount === null ? "" : draft.amount.toFixed(2),
    merchant,
    category: offeredCategories.includes(category) ? category : "",
    date: draft.date,
  };
}

/** The line shown under the quick-add box once the form is filled, pointing at what's left to do. */
export function describeQuickAddFill(values: QuickAddFormValues): string {
  return values.amount
    ? "Filled in from your note. Check it, then save."
    : "Your note had no amount. Enter it below, then check the rest.";
}
