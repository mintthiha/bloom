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

describe("describeProposedAction — savings goal changes", () => {
  const unchangedGoal = {
    kind: "SAVINGS_GOAL_CHANGE" as const,
    goalId: "goal-japan",
    currentName: "Japan trip",
    name: null,
    targetAmount: null,
    currentTargetAmount: 3000,
    targetDate: null,
    currentTargetDate: "2027-06-30",
    accountId: null,
    accountLabel: null,
    currentAccountLabel: "Rainy day (Savings)",
  };

  it("lists only the new target and says what it replaces", () => {
    const details = describeProposedAction({ ...unchangedGoal, targetAmount: 4000 });

    expect(details).toEqual({
      eyebrow: "Savings goal change",
      title: "Japan trip",
      rows: [{ label: "Target", value: "$4,000.00" }],
      replacementNote: "Currently: target $3,000.00. Nothing else about the goal changes.",
      confirmLabel: "Update goal",
      savedMessage: 'Goal "Japan trip" updated',
      destination: { href: "/goals", label: "View goals" },
    });
  });

  it("lists a rename, a new deadline, and a new account, and names the goal by its new name once saved", () => {
    const details = describeProposedAction({
      ...unchangedGoal,
      name: "Tokyo trip",
      targetDate: "2027-08-31",
      accountId: "account-chequing",
      accountLabel: "Everyday (Chequing)",
    });

    expect(details.rows).toEqual([
      { label: "New name", value: "Tokyo trip" },
      { label: "Deadline", value: "Aug 31, 2027" },
      { label: "Account", value: "Everyday (Chequing)" },
    ]);
    expect(details.replacementNote).toBe(
      "Currently: deadline Jun 30, 2027, account Rainy day (Savings). " +
        "Nothing else about the goal changes."
    );
    expect(details.savedMessage).toBe('Goal "Tokyo trip" updated');
  });

  it("says an open-ended goal has no deadline yet when the change adds one", () => {
    const details = describeProposedAction({
      ...unchangedGoal,
      targetDate: "2027-01-31",
      currentTargetDate: null,
    });

    expect(details.replacementNote).toBe(
      "Currently: no deadline. Nothing else about the goal changes."
    );
  });

  it("only reassures that nothing else changes when the goal is just renamed", () => {
    const details = describeProposedAction({ ...unchangedGoal, name: "Tokyo trip" });

    expect(details.replacementNote).toBe("Nothing else about the goal changes.");
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
