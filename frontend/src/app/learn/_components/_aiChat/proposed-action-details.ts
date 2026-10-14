import type { ProposedChatAction } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { formatTargetDate } from "@/lib/goal-pace";

/** Everything a draft's card shows, worked out from the draft itself. */
export type ProposedActionDetails = {
  /** Small label above the title naming what kind of thing was drafted. */
  eyebrow: string;
  title: string;
  rows: { label: string; value: string }[];
  /** What confirming would overwrite, or null when the draft creates something new. */
  replacementNote: string | null;
  confirmLabel: string;
  /** The toast shown once the draft has been saved. */
  savedMessage: string;
  /** Where the saved item can be seen in the app. */
  destination: { href: string; label: string };
};

/**
 * Describes a draft for its confirmation card. A draft that would overwrite something the user
 * already has — a budget's limit, a merchant's rule — is worded as a change and says what it
 * replaces, so confirming never overwrites anything unannounced.
 */
export function describeProposedAction(proposedAction: ProposedChatAction): ProposedActionDetails {
  switch (proposedAction.kind) {
    case "BUDGET": {
      const isNewBudget = proposedAction.currentMonthlyLimit === null;
      return {
        eyebrow: isNewBudget ? "New budget" : "Budget change",
        title: proposedAction.category,
        rows: [{ label: "Monthly limit", value: formatCurrency(proposedAction.monthlyLimit) }],
        replacementNote:
          proposedAction.currentMonthlyLimit === null
            ? null
            : `Replaces your current ${formatCurrency(proposedAction.currentMonthlyLimit)} limit.`,
        confirmLabel: isNewBudget ? "Create budget" : "Update budget",
        savedMessage: `${proposedAction.category} budget ${isNewBudget ? "created" : "updated"}`,
        destination: { href: "/budgets", label: "View budgets" },
      };
    }
    case "SAVINGS_GOAL":
      return {
        eyebrow: "New savings goal",
        title: proposedAction.name,
        rows: [
          { label: "Target", value: formatCurrency(proposedAction.targetAmount) },
          {
            label: "Deadline",
            value: formatTargetDate(proposedAction.targetDate) ?? "No deadline",
          },
          { label: "Account", value: proposedAction.accountLabel },
        ],
        replacementNote: null,
        confirmLabel: "Create goal",
        savedMessage: `Goal "${proposedAction.name}" created`,
        destination: { href: "/goals", label: "View goals" },
      };
    case "CATEGORIZATION_RULE": {
      const isNewRule = proposedAction.currentCategory === null;
      return {
        eyebrow: isNewRule ? "New categorization rule" : "Rule change",
        title: proposedAction.merchant,
        rows: [{ label: "Category", value: proposedAction.category }],
        replacementNote: isNewRule
          ? null
          : `Replaces this merchant's current rule, which uses ${proposedAction.currentCategory}.`,
        confirmLabel: isNewRule ? "Create rule" : "Update rule",
        savedMessage:
          `Rule ${isNewRule ? "created" : "updated"}: ` +
          `${proposedAction.merchant} → ${proposedAction.category}`,
        destination: { href: "/auto-categorize", label: "View rules" },
      };
    }
  }
}
