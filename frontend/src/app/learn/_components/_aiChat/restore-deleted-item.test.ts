import { beforeEach, describe, expect, it, vi } from "vitest";
import { restoreDeletedItem } from "./restore-deleted-item";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    restoreBudget: vi.fn(),
    restoreSavingsGoal: vi.fn(),
    restoreCategorizationRule: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.restoreBudget.mockResolvedValue({ id: "budget-dining" });
  apiMock.restoreSavingsGoal.mockResolvedValue({ id: "goal-japan" });
  apiMock.restoreCategorizationRule.mockResolvedValue({ id: "rule-tim-hortons" });
});

describe("restoreDeletedItem", () => {
  it("restores a deleted budget by its id", async () => {
    await restoreDeletedItem({
      kind: "BUDGET_DELETION",
      budgetId: "budget-dining",
      category: "Dining",
      monthlyLimit: 150,
    });

    expect(apiMock.restoreBudget).toHaveBeenCalledWith("budget-dining");
    expect(apiMock.restoreSavingsGoal).not.toHaveBeenCalled();
    expect(apiMock.restoreCategorizationRule).not.toHaveBeenCalled();
  });

  it("restores a deleted savings goal by its id", async () => {
    await restoreDeletedItem({
      kind: "SAVINGS_GOAL_DELETION",
      goalId: "goal-japan",
      name: "Japan trip",
      targetAmount: 3000,
      targetDate: null,
      accountLabel: "Rainy day (Savings)",
    });

    expect(apiMock.restoreSavingsGoal).toHaveBeenCalledWith("goal-japan");
  });

  it("restores a deleted categorization rule by its id", async () => {
    await restoreDeletedItem({
      kind: "CATEGORIZATION_RULE_DELETION",
      ruleId: "rule-tim-hortons",
      merchant: "Tim Hortons",
      category: "Dining",
    });

    expect(apiMock.restoreCategorizationRule).toHaveBeenCalledWith("rule-tim-hortons");
  });

  it("refuses to undo a draft that deleted nothing", async () => {
    await expect(
      restoreDeletedItem({
        kind: "BUDGET",
        category: "Groceries",
        monthlyLimit: 400,
        currentMonthlyLimit: null,
      })
    ).rejects.toThrow("Only a deletion can be undone");
    expect(apiMock.restoreBudget).not.toHaveBeenCalled();
  });
});
