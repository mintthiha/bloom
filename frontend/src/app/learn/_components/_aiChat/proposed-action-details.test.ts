import { describe, expect, it } from "vitest";
import { describeProposedAction } from "./proposed-action-details";

describe("describeProposedAction — budgets", () => {
  it("describes a budget for a category that has none as something new", () => {
    const details = describeProposedAction({
      kind: "BUDGET",
      category: "Groceries",
      monthlyLimit: 400,
      currentMonthlyLimit: null,
    });

    expect(details).toEqual({
      eyebrow: "New budget",
      title: "Groceries",
      rows: [{ label: "Monthly limit", value: "$400.00" }],
      replacementNote: null,
      confirmLabel: "Create budget",
      savedMessage: "Groceries budget created",
      destination: { href: "/budgets", label: "View budgets" },
    });
  });

  it("describes a new limit for an existing budget as a change and says what it replaces", () => {
    const details = describeProposedAction({
      kind: "BUDGET",
      category: "Dining",
      monthlyLimit: 200,
      currentMonthlyLimit: 150.5,
    });

    expect(details).toMatchObject({
      eyebrow: "Budget change",
      rows: [{ label: "Monthly limit", value: "$200.00" }],
      replacementNote: "Replaces your current $150.50 limit.",
      confirmLabel: "Update budget",
      savedMessage: "Dining budget updated",
    });
  });
});

describe("describeProposedAction — savings goals", () => {
  it("lists the target, the deadline, and the account the goal tracks", () => {
    const details = describeProposedAction({
      kind: "SAVINGS_GOAL",
      name: "Japan trip",
      targetAmount: 3000,
      targetDate: "2027-06-30",
      accountId: "account-savings",
      accountLabel: "Rainy day (Savings)",
    });

    expect(details).toEqual({
      eyebrow: "New savings goal",
      title: "Japan trip",
      rows: [
        { label: "Target", value: "$3,000.00" },
        { label: "Deadline", value: "Jun 30, 2027" },
        { label: "Account", value: "Rainy day (Savings)" },
      ],
      replacementNote: null,
      confirmLabel: "Create goal",
      savedMessage: 'Goal "Japan trip" created',
      destination: { href: "/goals", label: "View goals" },
    });
  });

  it("says an open-ended goal has no deadline", () => {
    const details = describeProposedAction({
      kind: "SAVINGS_GOAL",
      name: "Emergency fund",
      targetAmount: 5000,
      targetDate: null,
      accountId: "account-savings",
      accountLabel: "Rainy day (Savings)",
    });

    expect(details.rows).toContainEqual({ label: "Deadline", value: "No deadline" });
  });
});

describe("describeProposedAction — categorization rules", () => {
  it("describes a rule for a merchant that has none as something new", () => {
    const details = describeProposedAction({
      kind: "CATEGORIZATION_RULE",
      merchant: "Tim Hortons",
      category: "Dining",
      currentCategory: null,
    });

    expect(details).toEqual({
      eyebrow: "New categorization rule",
      title: "Tim Hortons",
      rows: [{ label: "Category", value: "Dining" }],
      replacementNote: null,
      confirmLabel: "Create rule",
      savedMessage: "Rule created: Tim Hortons → Dining",
      destination: { href: "/auto-categorize", label: "View rules" },
    });
  });

  it("describes a new category for an existing rule as a change and says what it replaces", () => {
    const details = describeProposedAction({
      kind: "CATEGORIZATION_RULE",
      merchant: "Tim Hortons",
      category: "Groceries",
      currentCategory: "Dining",
    });

    expect(details).toMatchObject({
      eyebrow: "Rule change",
      replacementNote: "Replaces this merchant's current rule, which uses Dining.",
      confirmLabel: "Update rule",
      savedMessage: "Rule updated: Tim Hortons → Groceries",
    });
  });
});
