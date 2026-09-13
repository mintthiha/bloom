import { beforeEach, describe, expect, it, vi } from "vitest";

const { credentialsAuthMock, accountMock, profileMock, budgetMock, savingsGoalMock } = vi.hoisted(
  () => ({
    credentialsAuthMock: {
      registerDemoUser: vi.fn(),
      issueRememberTokenForUserId: vi.fn(),
    },
    accountMock: {
      createAccount: vi.fn(),
      importTransactions: vi.fn(),
    },
    profileMock: {
      upsertProfile: vi.fn(),
    },
    budgetMock: {
      upsertBudget: vi.fn(),
      setRolloverEnabled: vi.fn(),
    },
    savingsGoalMock: {
      createSavingsGoal: vi.fn(),
    },
  })
);

vi.mock("./credentialsAuthService", () => credentialsAuthMock);
vi.mock("./accountService", () => accountMock);
vi.mock("./profileService", () => profileMock);
vi.mock("./budgetService", () => budgetMock);
vi.mock("./savingsGoalService", () => savingsGoalMock);

const DEMO_EXPIRES_AT = new Date("2026-09-12T00:00:00Z");

describe("demoService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    credentialsAuthMock.registerDemoUser.mockResolvedValue({
      id: "demo-user-1",
      email: "demo-abc@bloom.local",
      demoExpiresAt: DEMO_EXPIRES_AT,
    });
    accountMock.createAccount.mockImplementation(async (_userId, _ownerName, accountType) => ({
      id: `account-${accountType}`,
      accountType,
    }));
    accountMock.importTransactions.mockResolvedValue({ imported: 1 });
    profileMock.upsertProfile.mockResolvedValue({});
    budgetMock.upsertBudget.mockImplementation(async (_userId, input) => ({
      id: `budget-${input.category}`,
      ...input,
    }));
    budgetMock.setRolloverEnabled.mockResolvedValue({});
    savingsGoalMock.createSavingsGoal.mockResolvedValue({});
    credentialsAuthMock.issueRememberTokenForUserId.mockResolvedValue({
      token: "remember-token",
      expiresAt: DEMO_EXPIRES_AT,
    });
  });

  it("creates a demo user, profile, and the three starter accounts", async () => {
    const { createDemoAccount } = await import("./demoService");

    await createDemoAccount();

    expect(credentialsAuthMock.registerDemoUser).toHaveBeenCalledTimes(1);
    expect(profileMock.upsertProfile).toHaveBeenCalledWith(
      "demo-user-1",
      expect.objectContaining({ email: "demo-abc@bloom.local" })
    );
    expect(accountMock.createAccount).toHaveBeenCalledWith(
      "demo-user-1",
      "Alex Rivera",
      "CHEQUING",
      "Everyday Chequing"
    );
    expect(accountMock.createAccount).toHaveBeenCalledWith(
      "demo-user-1",
      "Alex Rivera",
      "SAVINGS",
      "High-Interest Savings"
    );
    expect(accountMock.createAccount).toHaveBeenCalledWith(
      "demo-user-1",
      "Alex Rivera",
      "TFSA",
      "TFSA"
    );
  });

  it("imports six months of transactions into each account", async () => {
    const { createDemoAccount } = await import("./demoService");

    await createDemoAccount();

    const chequingCall = accountMock.importTransactions.mock.calls.find(
      (call) => call[1] === "account-CHEQUING"
    );
    const savingsCall = accountMock.importTransactions.mock.calls.find(
      (call) => call[1] === "account-SAVINGS"
    );
    const tfsaCall = accountMock.importTransactions.mock.calls.find(
      (call) => call[1] === "account-TFSA"
    );

    expect(chequingCall).toBeDefined();
    expect(savingsCall).toBeDefined();
    expect(tfsaCall).toBeDefined();

    const chequingRows = chequingCall![2];
    // 6 months x (salary + rent + 6 categories + savings transfer) = 6 x 9
    expect(chequingRows).toHaveLength(54);
    expect(chequingRows.every((row: { amount: number }) => row.amount > 0)).toBe(true);

    const savingsRows = savingsCall![2];
    expect(savingsRows).toHaveLength(6);

    const tfsaRows = tfsaCall![2];
    expect(tfsaRows).toHaveLength(1);
  });

  it("enables rollover only for the budgets flagged for it", async () => {
    const { createDemoAccount } = await import("./demoService");

    await createDemoAccount();

    expect(budgetMock.upsertBudget).toHaveBeenCalledWith(
      "demo-user-1",
      expect.objectContaining({ category: "Groceries" })
    );
    expect(budgetMock.setRolloverEnabled).toHaveBeenCalledWith(
      "demo-user-1",
      "budget-Groceries",
      true
    );
    expect(budgetMock.setRolloverEnabled).toHaveBeenCalledWith(
      "demo-user-1",
      "budget-Dining",
      true
    );
    expect(budgetMock.setRolloverEnabled).not.toHaveBeenCalledWith(
      "demo-user-1",
      "budget-Transport",
      true
    );
  });

  it("creates a savings goal against the savings account", async () => {
    const { createDemoAccount } = await import("./demoService");

    await createDemoAccount();

    expect(savingsGoalMock.createSavingsGoal).toHaveBeenCalledWith("demo-user-1", {
      accountId: "account-SAVINGS",
      name: "Emergency Fund",
      targetAmount: 10000,
    });
  });

  it("returns the remember-me token issued for the new demo user", async () => {
    const { createDemoAccount } = await import("./demoService");

    const result = await createDemoAccount();

    expect(credentialsAuthMock.issueRememberTokenForUserId).toHaveBeenCalledWith("demo-user-1");
    expect(result).toEqual({ token: "remember-token", expiresAt: DEMO_EXPIRES_AT });
  });
});
