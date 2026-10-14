import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../middleware/errorHandler";
import {
  confirmProposedAction,
  dismissProposedAction,
  loadChatActionReferenceData,
} from "./chatActionService";

const {
  accountServiceMock,
  budgetServiceMock,
  categorizationRuleServiceMock,
  categoryServiceMock,
  chatHistoryMock,
  savingsGoalServiceMock,
} = vi.hoisted(() => ({
  accountServiceMock: { listAccounts: vi.fn() },
  budgetServiceMock: { listBudgetLimits: vi.fn(), upsertBudget: vi.fn() },
  categorizationRuleServiceMock: { listRules: vi.fn(), upsertRule: vi.fn() },
  categoryServiceMock: { listCategories: vi.fn() },
  chatHistoryMock: { moveProposedActionStatus: vi.fn(), getProposedActionStatus: vi.fn() },
  savingsGoalServiceMock: { createSavingsGoal: vi.fn() },
}));

vi.mock("./accountService", () => accountServiceMock);
vi.mock("./budgetService", () => budgetServiceMock);
vi.mock("./categorizationRuleService", () => categorizationRuleServiceMock);
vi.mock("./categoryService", () => categoryServiceMock);
vi.mock("./chatHistoryService", () => chatHistoryMock);
vi.mock("./savingsGoalService", () => savingsGoalServiceMock);

const BUDGET_DRAFT = {
  kind: "BUDGET",
  category: "Groceries",
  monthlyLimit: 400,
  currentMonthlyLimit: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadChatActionReferenceData", () => {
  it("gathers the user's categories by type, accounts by display name, budgets, and rules", async () => {
    categoryServiceMock.listCategories.mockResolvedValue([
      { id: "c-1", name: "Groceries", type: "EXPENSE" },
      { id: "c-2", name: "Dining", type: "EXPENSE" },
      { id: "c-3", name: "Salary", type: "INCOME" },
    ]);
    accountServiceMock.listAccounts.mockResolvedValue([
      { id: "a-1", ownerName: "Thiha", nickname: "Rainy day", accountType: "SAVINGS", balance: 9 },
      { id: "a-2", ownerName: "Thiha", nickname: null, accountType: "CHEQUING", balance: 12 },
    ]);
    budgetServiceMock.listBudgetLimits.mockResolvedValue([
      { category: "Dining", monthlyLimit: 150 },
    ]);
    categorizationRuleServiceMock.listRules.mockResolvedValue([
      { id: "r-1", userId: "u-1", merchant: "Tim Hortons", category: "Dining" },
    ]);

    await expect(loadChatActionReferenceData("u-1")).resolves.toEqual({
      expenseCategoryNames: ["Groceries", "Dining"],
      incomeCategoryNames: ["Salary"],
      accounts: [
        { id: "a-1", name: "Rainy day", accountType: "SAVINGS" },
        { id: "a-2", name: "Thiha", accountType: "CHEQUING" },
      ],
      budgets: [{ category: "Dining", monthlyLimit: 150 }],
      rules: [{ merchant: "Tim Hortons", category: "Dining" }],
    });
    for (const listMock of [
      categoryServiceMock.listCategories,
      accountServiceMock.listAccounts,
      budgetServiceMock.listBudgetLimits,
      categorizationRuleServiceMock.listRules,
    ]) {
      expect(listMock).toHaveBeenCalledWith("u-1");
    }
  });
});

describe("confirmProposedAction", () => {
  it("claims the pending draft, then saves a budget through the budget service", async () => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue(BUDGET_DRAFT);

    await expect(confirmProposedAction("u-1", "m-1")).resolves.toEqual({
      id: "m-1",
      proposedActionStatus: "CONFIRMED",
    });

    expect(chatHistoryMock.moveProposedActionStatus).toHaveBeenCalledTimes(1);
    expect(chatHistoryMock.moveProposedActionStatus).toHaveBeenCalledWith(
      "u-1",
      "m-1",
      "PENDING",
      "CONFIRMED"
    );
    expect(budgetServiceMock.upsertBudget).toHaveBeenCalledWith("u-1", {
      category: "Groceries",
      monthlyLimit: 400,
    });
    expect(savingsGoalServiceMock.createSavingsGoal).not.toHaveBeenCalled();
    expect(categorizationRuleServiceMock.upsertRule).not.toHaveBeenCalled();
  });

  it("saves a savings goal with its deadline as a UTC date and no appearance or note", async () => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue({
      kind: "SAVINGS_GOAL",
      name: "Japan trip",
      targetAmount: 3000,
      targetDate: "2027-06-30",
      accountId: "a-1",
      accountLabel: "Rainy day (Savings)",
    });

    await confirmProposedAction("u-1", "m-1");

    expect(savingsGoalServiceMock.createSavingsGoal).toHaveBeenCalledWith("u-1", {
      accountId: "a-1",
      name: "Japan trip",
      targetAmount: 3000,
      targetDate: new Date("2027-06-30T00:00:00.000Z"),
      icon: null,
      color: null,
      note: null,
    });
  });

  it("saves an open-ended savings goal without a deadline", async () => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue({
      kind: "SAVINGS_GOAL",
      name: "Emergency fund",
      targetAmount: 5000,
      targetDate: null,
      accountId: "a-1",
      accountLabel: "Rainy day (Savings)",
    });

    await confirmProposedAction("u-1", "m-1");

    expect(savingsGoalServiceMock.createSavingsGoal).toHaveBeenCalledWith(
      "u-1",
      expect.objectContaining({ targetDate: null })
    );
  });

  it("saves a categorization rule marked as AI-suggested", async () => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue({
      kind: "CATEGORIZATION_RULE",
      merchant: "Tim Hortons",
      category: "Dining",
      currentCategory: null,
    });

    await confirmProposedAction("u-1", "m-1");

    expect(categorizationRuleServiceMock.upsertRule).toHaveBeenCalledWith(
      "u-1",
      "Tim Hortons",
      "Dining",
      "ai"
    );
  });

  it("hands the draft back to pending and rethrows when the save fails", async () => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue(BUDGET_DRAFT);
    budgetServiceMock.upsertBudget.mockRejectedValue(new AppError(400, "Category is required"));

    await expect(confirmProposedAction("u-1", "m-1")).rejects.toMatchObject({
      statusCode: 400,
      message: "Category is required",
    });

    expect(chatHistoryMock.moveProposedActionStatus).toHaveBeenLastCalledWith(
      "u-1",
      "m-1",
      "CONFIRMED",
      "PENDING"
    );
  });

  it("reports the save failure even when the draft cannot be handed back to pending", async () => {
    chatHistoryMock.moveProposedActionStatus
      .mockResolvedValueOnce(BUDGET_DRAFT)
      .mockRejectedValueOnce(new Error("database unavailable"));
    budgetServiceMock.upsertBudget.mockRejectedValue(new AppError(404, "Account not found"));

    await expect(confirmProposedAction("u-1", "m-1")).rejects.toMatchObject({
      statusCode: 404,
      message: "Account not found",
    });
  });

  it("returns 404 and saves nothing when the user has no such draft", async () => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue(null);
    chatHistoryMock.getProposedActionStatus.mockResolvedValue(null);

    await expect(confirmProposedAction("u-1", "missing")).rejects.toMatchObject({
      statusCode: 404,
      message: "Suggestion not found",
    });
    expect(chatHistoryMock.getProposedActionStatus).toHaveBeenCalledWith("u-1", "missing");
    expect(budgetServiceMock.upsertBudget).not.toHaveBeenCalled();
  });

  it.each([
    ["CONFIRMED", "This suggestion has already been saved"],
    ["DISMISSED", "This suggestion was dismissed"],
  ])("returns 409 and saves nothing when the draft is already %s", async (status, message) => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue(null);
    chatHistoryMock.getProposedActionStatus.mockResolvedValue(status);

    await expect(confirmProposedAction("u-1", "m-1")).rejects.toMatchObject({
      statusCode: 409,
      message,
    });
    expect(budgetServiceMock.upsertBudget).not.toHaveBeenCalled();
  });
});

describe("dismissProposedAction", () => {
  it("marks the pending draft dismissed without saving anything", async () => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue(BUDGET_DRAFT);

    await expect(dismissProposedAction("u-1", "m-1")).resolves.toEqual({
      id: "m-1",
      proposedActionStatus: "DISMISSED",
    });

    expect(chatHistoryMock.moveProposedActionStatus).toHaveBeenCalledWith(
      "u-1",
      "m-1",
      "PENDING",
      "DISMISSED"
    );
    expect(budgetServiceMock.upsertBudget).not.toHaveBeenCalled();
  });

  it("returns 409 when the draft was already saved", async () => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue(null);
    chatHistoryMock.getProposedActionStatus.mockResolvedValue("CONFIRMED");

    await expect(dismissProposedAction("u-1", "m-1")).rejects.toMatchObject({
      statusCode: 409,
      message: "This suggestion has already been saved",
    });
  });

  it("returns 404 when the user has no such draft", async () => {
    chatHistoryMock.moveProposedActionStatus.mockResolvedValue(null);
    chatHistoryMock.getProposedActionStatus.mockResolvedValue(null);

    await expect(dismissProposedAction("u-1", "missing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
