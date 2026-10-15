import { describe, expect, it } from "vitest";
import {
  buildChatActionInstructions,
  buildChatActionTools,
  interpretToolCall,
  selectUserMessagesSinceLastDraft,
  toModelMessages,
  type ChatActionReferenceData,
} from "./chatActionProposals";

const TODAY = new Date("2026-10-12T15:00:00.000Z");

const REFERENCE_DATA: ChatActionReferenceData = {
  expenseCategoryNames: ["Dining", "Groceries", "Health & Fitness"],
  incomeCategoryNames: ["Salary"],
  accounts: [
    { id: "account-chequing", name: "Everyday", accountType: "CHEQUING" },
    { id: "account-savings", name: "Rainy day", accountType: "SAVINGS" },
  ],
  budgets: [{ id: "budget-dining", category: "Dining", monthlyLimit: 150 }],
  rules: [{ id: "rule-tim-hortons", merchant: "Tim Hortons", category: "Dining" }],
  savingsGoals: [],
};

/** Reference data for a user with exactly one account, where a goal needs no account choice. */
const SINGLE_ACCOUNT_DATA: ChatActionReferenceData = {
  ...REFERENCE_DATA,
  accounts: [{ id: "account-savings", name: "Rainy day", accountType: "SAVINGS" }],
};

/** Reference data for a user who already has two savings goals to change. */
const GOAL_DATA: ChatActionReferenceData = {
  ...REFERENCE_DATA,
  savingsGoals: [
    {
      id: "goal-japan",
      name: "Japan trip",
      targetAmount: 3000,
      targetDate: "2027-06-30",
      accountId: "account-savings",
    },
    {
      id: "goal-emergency",
      name: "Emergency fund",
      targetAmount: 5000,
      targetDate: null,
      accountId: "account-chequing",
    },
  ],
};

/** A question that states every amount these tests draft with, so each counts as user-given. */
const QUESTION_STATING_AMOUNTS =
  "Use one of these: 50, 60, 80, 150, 200, 400, 3000, 5000, $1,200.50 or 99.999";

/**
 * Interprets a tool call against the shared reference data as of the fixed test date. Unless a
 * test says what the user typed, the question is one that states every amount the tests use.
 */
function interpret(
  toolName: string,
  toolArguments: Record<string, unknown>,
  referenceData: ChatActionReferenceData = REFERENCE_DATA,
  userWords: { question?: string; earlierUserMessages?: string[] } = {}
) {
  return interpretToolCall(toolName, toolArguments, {
    referenceData,
    today: TODAY,
    question: userWords.question ?? QUESTION_STATING_AMOUNTS,
    earlierUserMessages: userWords.earlierUserMessages ?? [],
  });
}

describe("interpretToolCall — budgets", () => {
  it("drafts a budget for a category that has none", () => {
    const interpretation = interpret("propose_budget", {
      category: "Groceries",
      monthlyLimit: 400,
    });

    expect(interpretation.proposedAction).toEqual({
      kind: "BUDGET",
      category: "Groceries",
      monthlyLimit: 400,
      currentMonthlyLimit: null,
    });
    expect(interpretation.reply).toBe(
      "I've drafted a monthly budget for Groceries. Review it below — nothing is saved until you confirm."
    );
  });

  it("records the limit a draft would replace when the category already has a budget", () => {
    const interpretation = interpret("propose_budget", { category: "Dining", monthlyLimit: 200 });

    expect(interpretation.proposedAction).toMatchObject({
      category: "Dining",
      monthlyLimit: 200,
      currentMonthlyLimit: 150,
    });
    expect(interpretation.reply).toContain("a new limit for your Dining budget");
  });

  it("uses the stored spelling of a category the model typed in another case or spacing", () => {
    const interpretation = interpret("propose_budget", {
      category: "  health  &  FITNESS ",
      monthlyLimit: 60,
    });

    expect(interpretation.proposedAction).toMatchObject({ category: "Health & Fitness" });
  });

  it.each([
    ["a number as text", "400", 400],
    ["text with a dollar sign and thousands separator", "$1,200.50", 1200.5],
    ["more than two decimals", 99.999, 100],
  ])("reads a limit given as %s", (_description, sentLimit, expectedLimit) => {
    const interpretation = interpret("propose_budget", {
      category: "Groceries",
      monthlyLimit: sentLimit,
    });

    expect(interpretation.proposedAction).toMatchObject({ monthlyLimit: expectedLimit });
  });

  it.each([
    ["missing", undefined],
    ["zero", 0],
    ["negative", -50],
    ["too small to be a cent", 0.004],
    ["not a number", "a lot"],
    ["empty text", ""],
    ["infinite", Number.POSITIVE_INFINITY],
    ["an object", { amount: 400 }],
  ])("asks for the limit instead of drafting when it is %s", (_description, sentLimit) => {
    const interpretation = interpret("propose_budget", {
      category: "Groceries",
      monthlyLimit: sentLimit,
    });

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "How much should the monthly limit for Groceries be?",
    });
  });

  it("refuses a category the user does not have, and lists the ones they do", () => {
    const interpretation = interpret("propose_budget", { category: "Pets", monthlyLimit: 80 });

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      'I can only set a budget for one of your expense categories, and "Pets" isn\'t one of them. ' +
        "Yours are: Dining, Groceries, Health & Fitness."
    );
  });

  it("refuses an income category, since budgets cap spending", () => {
    const interpretation = interpret("propose_budget", { category: "Salary", monthlyLimit: 80 });

    expect(interpretation.proposedAction).toBeNull();
  });

  it.each([
    ["missing", undefined],
    ["blank", "   "],
    ["not text", 12],
    ["longer than 50 characters", "a".repeat(51)],
  ])("asks which category when it is %s", (_description, sentCategory) => {
    const interpretation = interpret("propose_budget", {
      category: sentCategory,
      monthlyLimit: 80,
    });

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain("Which category should the budget be for?");
  });

  it("drafts nothing when the budget already has exactly that limit", () => {
    const interpretation = interpret("propose_budget", { category: "dining", monthlyLimit: 150 });

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "Your Dining budget is already set to that limit, so there is nothing to change.",
    });
  });
});

describe("interpretToolCall — savings goals", () => {
  it("drafts a goal on the account the model named by its full label", () => {
    const interpretation = interpret("propose_savings_goal", {
      goalName: "Japan trip",
      targetAmount: 3000,
      targetDate: "2027-06-30",
      account: "Rainy day (Savings)",
    });

    expect(interpretation.proposedAction).toEqual({
      kind: "SAVINGS_GOAL",
      name: "Japan trip",
      targetAmount: 3000,
      targetDate: "2027-06-30",
      accountId: "account-savings",
      accountLabel: "Rainy day (Savings)",
    });
    expect(interpretation.reply).toContain('a savings goal called "Japan trip"');
  });

  it("matches an account named without its type, in any case", () => {
    const interpretation = interpret("propose_savings_goal", {
      goalName: "Japan trip",
      targetAmount: 3000,
      account: "everyday",
    });

    expect(interpretation.proposedAction).toMatchObject({
      accountId: "account-chequing",
      accountLabel: "Everyday (Chequing)",
    });
  });

  it("uses the only account without being told which one", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Japan trip", targetAmount: 3000 },
      SINGLE_ACCOUNT_DATA
    );

    expect(interpretation.proposedAction).toMatchObject({ accountId: "account-savings" });
  });

  it.each([
    ["left out", undefined],
    ["null", null],
    ["empty", ""],
  ])("drafts an open-ended goal when the deadline is %s", (_description, sentTargetDate) => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Emergency fund", targetAmount: 5000, targetDate: sentTargetDate },
      SINGLE_ACCOUNT_DATA
    );

    expect(interpretation.proposedAction).toMatchObject({ targetDate: null });
  });

  it("accepts a deadline of today", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Gift", targetAmount: 50, targetDate: "2026-10-12" },
      SINGLE_ACCOUNT_DATA
    );

    expect(interpretation.proposedAction).toMatchObject({ targetDate: "2026-10-12" });
  });

  it("asks for another date when the deadline has already passed", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Japan trip", targetAmount: 3000, targetDate: "2026-10-11" },
      SINGLE_ACCOUNT_DATA
    );

    expect(interpretation).toEqual({
      proposedAction: null,
      reply:
        'The deadline I worked out for "Japan trip" (2026-10-11) has already passed. What date ' +
        "are you aiming for?",
    });
  });

  it.each([
    ["a month name", "June"],
    ["a date that does not exist", "2027-02-31"],
    ["a number", 20270630],
  ])("asks for the deadline again when it is %s", (_description, sentTargetDate) => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Japan trip", targetAmount: 3000, targetDate: sentTargetDate },
      SINGLE_ACCOUNT_DATA
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain('I couldn\'t work out the deadline for "Japan trip"');
  });

  it("asks which account when there are several and none was named", () => {
    const interpretation = interpret("propose_savings_goal", {
      goalName: "Japan trip",
      targetAmount: 3000,
    });

    expect(interpretation).toEqual({
      proposedAction: null,
      reply:
        'Which account should "Japan trip" track? Your accounts are: Everyday (Chequing), ' +
        "Rainy day (Savings).",
    });
  });

  it("asks which account when the named one matches none of them", () => {
    const interpretation = interpret("propose_savings_goal", {
      goalName: "Japan trip",
      targetAmount: 3000,
      account: "Vacation fund",
    });

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain('which account you mean by "Vacation fund"');
  });

  it("asks which account when the name fits more than one of them", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Japan trip", targetAmount: 3000, account: "Thiha" },
      {
        ...REFERENCE_DATA,
        accounts: [
          { id: "account-1", name: "Thiha", accountType: "CHEQUING" },
          { id: "account-2", name: "Thiha", accountType: "TFSA" },
        ],
      }
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain("Thiha (Chequing), Thiha (TFSA)");
  });

  it("asks for the amount when it is missing", () => {
    const interpretation = interpret("propose_savings_goal", { goalName: "Japan trip" });

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "To draft that goal, tell me how much you want to save.",
    });
  });

  it.each([
    ["missing", undefined],
    ["longer than 100 characters", "a".repeat(101)],
  ])("asks for a name when it is %s", (_description, sentName) => {
    const interpretation = interpret("propose_savings_goal", {
      goalName: sentName,
      targetAmount: 3000,
    });

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "To draft that goal, tell me what to call it.",
    });
  });

  it("explains that a goal needs an account when the user has none", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Japan trip", targetAmount: 3000 },
      { ...REFERENCE_DATA, accounts: [] }
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain("you don't have an account in Bloom yet");
  });
});

describe("interpretToolCall — amounts must come from the user", () => {
  it("asks for the limit when the model supplies one the user never typed", () => {
    const interpretation = interpret(
      "propose_budget",
      { category: "Groceries", monthlyLimit: 300 },
      REFERENCE_DATA,
      { question: "Set a budget for groceries" }
    );

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "How much should the monthly limit for Groceries be?",
    });
  });

  it("asks for the target when the model supplies one the user never typed", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Trip", targetAmount: 5000 },
      SINGLE_ACCOUNT_DATA,
      { question: "Create a goal for a trip in June" }
    );

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "To draft that goal, tell me how much you want to save.",
    });
  });

  it("asks for both the name and the target when neither holds up", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { targetAmount: 5000 },
      SINGLE_ACCOUNT_DATA,
      { question: "Create a goal" }
    );

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "To draft that goal, tell me what to call it and how much you want to save.",
    });
  });

  it("accepts an amount the user typed in an earlier message", () => {
    const interpretation = interpret(
      "propose_budget",
      { category: "Groceries", monthlyLimit: 300 },
      REFERENCE_DATA,
      {
        question: "Groceries please",
        earlierUserMessages: ["What is a TFSA?", "I want a $300 budget"],
      }
    );

    expect(interpretation.proposedAction).toMatchObject({ monthlyLimit: 300 });
  });

  it.each([
    ["a dollar sign", "make it $450", 450],
    ["a thousands separator and cents", "cap it at 1,200.50 a month", 1200.5],
    ["a k for thousands", "about 3k", 3000],
    ["a decimal with a capital K", "1.5K should do", 1500],
    ["a number that ends the sentence", "Set groceries to 400.", 400],
    ["a number next to other punctuation", "(400/month)", 400],
  ])("recognizes an amount typed with %s", (_description, question, expectedLimit) => {
    const interpretation = interpret(
      "propose_budget",
      { category: "Groceries", monthlyLimit: expectedLimit },
      REFERENCE_DATA,
      { question }
    );

    expect(interpretation.proposedAction).toMatchObject({ monthlyLimit: expectedLimit });
  });

  it("does not read a k that starts another word as thousands", () => {
    const interpretation = interpret(
      "propose_budget",
      { category: "Groceries", monthlyLimit: 3000 },
      REFERENCE_DATA,
      { question: "Budget for lunches for my 3 kids" }
    );

    expect(interpretation.proposedAction).toBeNull();
  });
});

describe("interpretToolCall — a goal's account in the user's own words", () => {
  it("uses the account the user named when the model left it out", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Trip", targetAmount: 3000 },
      REFERENCE_DATA,
      { question: "$3000, in my RAINY  day account" }
    );

    expect(interpretation.proposedAction).toMatchObject({
      accountId: "account-savings",
      accountLabel: "Rainy day (Savings)",
    });
  });

  it("uses the account the user named when the model named one that does not exist", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Trip", targetAmount: 3000, account: "Vacation fund" },
      REFERENCE_DATA,
      { question: "Save 3000 in Everyday" }
    );

    expect(interpretation.proposedAction).toMatchObject({ accountId: "account-chequing" });
  });

  it("prefers the account the model named when it is one of the user's", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Trip", targetAmount: 3000, account: "Everyday (Chequing)" },
      REFERENCE_DATA,
      { question: "Save 3000, not in Rainy day" }
    );

    expect(interpretation.proposedAction).toMatchObject({ accountId: "account-chequing" });
  });

  it("uses an account the user named earlier in the same request", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Japan trip", targetAmount: 3000 },
      REFERENCE_DATA,
      {
        question: "Call it Japan trip",
        earlierUserMessages: ["Something for Everyday", "Save 3000 in my Rainy day account"],
      }
    );

    expect(interpretation.proposedAction).toMatchObject({ accountId: "account-savings" });
  });

  it("lets the account named in the question win over one named earlier", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Japan trip", targetAmount: 3000 },
      REFERENCE_DATA,
      {
        question: "Actually use Everyday",
        earlierUserMessages: ["Save 3000 in my Rainy day account"],
      }
    );

    expect(interpretation.proposedAction).toMatchObject({ accountId: "account-chequing" });
  });

  it("asks which account when the user named more than one", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Trip", targetAmount: 3000 },
      REFERENCE_DATA,
      { question: "Save 3000 in Everyday or Rainy day" }
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain('Which account should "Trip" track?');
  });

  it("does not take an account name found inside a longer word as a mention", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Trip", targetAmount: 3000 },
      {
        ...REFERENCE_DATA,
        accounts: [
          { id: "account-car", name: "Car", accountType: "SAVINGS" },
          { id: "account-home", name: "Home (joint)", accountType: "SAVINGS" },
        ],
      },
      { question: "Put 3000 on my card for the trip" }
    );

    expect(interpretation.proposedAction).toBeNull();
  });

  it("matches an account whose name contains punctuation", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Trip", targetAmount: 3000 },
      {
        ...REFERENCE_DATA,
        accounts: [
          { id: "account-car", name: "Car", accountType: "SAVINGS" },
          { id: "account-home", name: "Home (joint)", accountType: "SAVINGS" },
        ],
      },
      { question: "3000 in home (joint) please" }
    );

    expect(interpretation.proposedAction).toMatchObject({ accountId: "account-home" });
  });
});

describe("interpretToolCall — categorization rules", () => {
  it("drafts a rule for a merchant that has none", () => {
    const interpretation = interpret("propose_categorization_rule", {
      merchant: "  Loblaws ",
      category: "groceries",
    });

    expect(interpretation).toEqual({
      proposedAction: {
        kind: "CATEGORIZATION_RULE",
        merchant: "Loblaws",
        category: "Groceries",
        currentCategory: null,
      },
      reply:
        "I've drafted a rule for Loblaws. Review it below — nothing is saved until you confirm.",
    });
  });

  it("allows an income category", () => {
    const interpretation = interpret("propose_categorization_rule", {
      merchant: "Acme Payroll",
      category: "Salary",
    });

    expect(interpretation.proposedAction).toMatchObject({ category: "Salary" });
  });

  it("records the category a draft would replace on the merchant's existing rule", () => {
    const interpretation = interpret("propose_categorization_rule", {
      merchant: "Tim Hortons",
      category: "Groceries",
    });

    expect(interpretation.proposedAction).toMatchObject({
      category: "Groceries",
      currentCategory: "Dining",
    });
  });

  it("drafts nothing when the merchant's rule already points at that category", () => {
    const interpretation = interpret("propose_categorization_rule", {
      merchant: "Tim Hortons",
      category: "Dining",
    });

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "You already have a rule that puts Tim Hortons in Dining.",
    });
  });

  it("treats a merchant spelled in another case as a new rule, as the rules page does", () => {
    const interpretation = interpret("propose_categorization_rule", {
      merchant: "tim hortons",
      category: "Dining",
    });

    expect(interpretation.proposedAction).toMatchObject({
      merchant: "tim hortons",
      currentCategory: null,
    });
  });

  it("asks which merchant when it is missing", () => {
    const interpretation = interpret("propose_categorization_rule", { category: "Dining" });

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "Which merchant should the rule apply to?",
    });
  });

  it("asks which category when it is missing", () => {
    const interpretation = interpret("propose_categorization_rule", { merchant: "Loblaws" });

    expect(interpretation).toEqual({
      proposedAction: null,
      reply: "Which category should Loblaws transactions go in?",
    });
  });

  it("refuses a category the user does not have, and lists every category they do", () => {
    const interpretation = interpret("propose_categorization_rule", {
      merchant: "Loblaws",
      category: "Food",
    });

    expect(interpretation).toEqual({
      proposedAction: null,
      reply:
        '"Food" isn\'t one of your categories. Yours are: Dining, Groceries, Health & Fitness, Salary.',
    });
  });
});

describe("interpretToolCall — savings goal changes", () => {
  /** Interprets a goal change against the user who has goals, given what they typed. */
  function interpretGoalChange(toolArguments: Record<string, unknown>, question: string) {
    return interpret("propose_savings_goal_change", toolArguments, GOAL_DATA, { question });
  }

  it("drafts a new target the user typed, recording what it replaces and changing nothing else", () => {
    const interpretation = interpretGoalChange(
      { goal: "Japan trip", targetAmount: 4000 },
      "Change my Japan trip goal target to $4,000"
    );

    expect(interpretation.proposedAction).toEqual({
      kind: "SAVINGS_GOAL_CHANGE",
      goalId: "goal-japan",
      currentName: "Japan trip",
      name: null,
      targetAmount: 4000,
      currentTargetAmount: 3000,
      targetDate: null,
      currentTargetDate: "2027-06-30",
      accountId: null,
      accountLabel: null,
      currentAccountLabel: "Rainy day (Savings)",
    });
    expect(interpretation.reply).toContain('changes to your "Japan trip" goal');
    expect(interpretation.reply).toContain("nothing is saved until you confirm");
  });

  it("drafts a rename, a new deadline, and a move to another account together", () => {
    const interpretation = interpretGoalChange(
      {
        goal: "japan TRIP",
        newGoalName: "Tokyo trip",
        targetDate: "2027-08-31",
        account: "Everyday (Chequing)",
      },
      "Rename Japan trip to Tokyo trip, push it to August 2027 and move it to Everyday"
    );

    expect(interpretation.proposedAction).toMatchObject({
      goalId: "goal-japan",
      currentName: "Japan trip",
      name: "Tokyo trip",
      targetAmount: null,
      targetDate: "2027-08-31",
      currentTargetDate: "2027-06-30",
      accountId: "account-chequing",
      accountLabel: "Everyday (Chequing)",
      currentAccountLabel: "Rainy day (Savings)",
    });
  });

  it("gives an open-ended goal its first deadline", () => {
    const interpretation = interpretGoalChange(
      { goal: "Emergency fund", targetDate: "2027-01-31" },
      "Give my emergency fund a deadline of January 31 2027"
    );

    expect(interpretation.proposedAction).toMatchObject({
      targetDate: "2027-01-31",
      currentTargetDate: null,
      currentAccountLabel: "Everyday (Chequing)",
    });
  });

  it("drops an amount the user never typed but keeps the change they asked for", () => {
    const interpretation = interpretGoalChange(
      { goal: "Japan trip", targetAmount: 3500, targetDate: "2027-09-30" },
      "Move my Japan trip deadline to the end of September next year"
    );

    expect(interpretation.proposedAction).toMatchObject({
      targetAmount: null,
      targetDate: "2027-09-30",
    });
  });

  it("asks for the target when the only change is an amount the user never typed", () => {
    const interpretation = interpretGoalChange(
      { goal: "Japan trip", targetAmount: 3500 },
      "Raise my Japan trip target"
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe('How much should the new target for "Japan trip" be?');
  });

  it("asks what to change when every value matches the goal as it is", () => {
    const interpretation = interpretGoalChange(
      {
        goal: "Japan trip",
        newGoalName: "Japan trip",
        targetAmount: 3000,
        targetDate: "2027-06-30",
        account: "Rainy day (Savings)",
      },
      "Set my Japan trip goal to 3000 by 2027-06-30"
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      'What would you like to change about "Japan trip"? I can change its name, target, ' +
        "deadline, or account."
    );
  });

  it("asks which goal when none was named, listing the user's goals", () => {
    const interpretation = interpretGoalChange({ targetAmount: 4000 }, "Change my goal to 4000");

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      'Which goal should I change? Your goals are: "Japan trip", "Emergency fund".'
    );
  });

  it("says when the named goal does not exist, listing the user's goals", () => {
    const interpretation = interpretGoalChange(
      { goal: "House", targetAmount: 4000 },
      "Change my house goal to 4000"
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      `I couldn't find a goal called "House". Your goals are: "Japan trip", "Emergency fund".`
    );
  });

  it("sends the user to the Goals page when two goals share the name", () => {
    const interpretation = interpret(
      "propose_savings_goal_change",
      { goal: "Japan trip", targetAmount: 4000 },
      {
        ...GOAL_DATA,
        savingsGoals: [
          ...GOAL_DATA.savingsGoals,
          { ...GOAL_DATA.savingsGoals[0]!, id: "goal-japan-2" },
        ],
      },
      { question: "Change my Japan trip goal to 4000" }
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain('more than one goal called "Japan trip"');
    expect(interpretation.reply).toContain("Goals page");
  });

  it("asks for another date when the new deadline has already passed", () => {
    const interpretation = interpretGoalChange(
      { goal: "Japan trip", targetDate: "2026-10-11" },
      "Move Japan trip to yesterday"
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain("(2026-10-11) has already passed");
  });

  it("asks for the date again when the model sent one that is not a date", () => {
    const interpretation = interpretGoalChange(
      { goal: "Japan trip", targetDate: "next summer" },
      "Move Japan trip to next summer"
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain(`couldn't work out the new deadline for "Japan trip"`);
  });

  it("asks which account when the named one matches none of the user's", () => {
    const interpretation = interpretGoalChange(
      { goal: "Japan trip", account: "Vacation fund" },
      "Move Japan trip to my vacation fund"
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      `I couldn't tell which account you mean by "Vacation fund". Your accounts are: ` +
        "Everyday (Chequing), Rainy day (Savings)."
    );
  });

  it("explains there is nothing to change for a user with no goals", () => {
    const interpretation = interpret("propose_savings_goal_change", { goal: "Japan trip" });

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      "You don't have any savings goals yet, so there is nothing to change."
    );
  });

  it("turns a new goal named after an existing one into a change to that goal", () => {
    const interpretation = interpret(
      "propose_savings_goal",
      { goalName: "Japan Trip", targetAmount: 4000 },
      GOAL_DATA,
      { question: "Change my Japan trip goal target to $4000" }
    );

    expect(interpretation.proposedAction).toMatchObject({
      kind: "SAVINGS_GOAL_CHANGE",
      goalId: "goal-japan",
      targetAmount: 4000,
      targetDate: null,
      accountId: null,
    });
  });
});

describe("interpretToolCall — deletions", () => {
  /** Interprets a deletion against the user who has a budget, two goals, and a rule. */
  function interpretDeletion(
    toolArguments: Record<string, unknown>,
    referenceData: ChatActionReferenceData = GOAL_DATA
  ) {
    return interpret("propose_deletion", toolArguments, referenceData);
  }

  it("drafts deleting a budget, with the limit that identifies it", () => {
    const interpretation = interpretDeletion({ itemType: "budget", name: "dining" });

    expect(interpretation.proposedAction).toEqual({
      kind: "BUDGET_DELETION",
      budgetId: "budget-dining",
      category: "Dining",
      monthlyLimit: 150,
    });
    expect(interpretation.reply).toBe(
      "I've drafted the deletion of your Dining budget. Review it below — nothing is deleted " +
        "until you confirm."
    );
  });

  it("drafts deleting a savings goal, with its target, deadline, and account", () => {
    const interpretation = interpretDeletion({ itemType: "savings goal", name: "Japan trip" });

    expect(interpretation.proposedAction).toEqual({
      kind: "SAVINGS_GOAL_DELETION",
      goalId: "goal-japan",
      name: "Japan trip",
      targetAmount: 3000,
      targetDate: "2027-06-30",
      accountLabel: "Rainy day (Savings)",
    });
    expect(interpretation.reply).toContain('deletion of your "Japan trip" goal');
  });

  it("drafts deleting a categorization rule, with the category it files into", () => {
    const interpretation = interpretDeletion({
      itemType: "categorization rule",
      name: "Tim Hortons",
    });

    expect(interpretation.proposedAction).toEqual({
      kind: "CATEGORIZATION_RULE_DELETION",
      ruleId: "rule-tim-hortons",
      merchant: "Tim Hortons",
      category: "Dining",
    });
  });

  it("finds the item by name when the model gave the wrong kind of thing", () => {
    const interpretation = interpretDeletion({ itemType: "budget", name: "Tim Hortons" });

    expect(interpretation.proposedAction).toMatchObject({ kind: "CATEGORIZATION_RULE_DELETION" });
  });

  it("finds the item by name when the model gave no kind of thing at all", () => {
    const interpretation = interpretDeletion({ name: "Emergency fund" });

    expect(interpretation.proposedAction).toMatchObject({
      kind: "SAVINGS_GOAL_DELETION",
      goalId: "goal-emergency",
    });
  });

  it("uses the kind the model gave to choose between a budget and a rule with the same name", () => {
    const sharedNameData: ChatActionReferenceData = {
      ...GOAL_DATA,
      rules: [{ id: "rule-dining", merchant: "Dining", category: "Dining" }],
    };

    expect(
      interpretDeletion({ itemType: "categorization rule", name: "Dining" }, sharedNameData)
        .proposedAction
    ).toMatchObject({ kind: "CATEGORIZATION_RULE_DELETION", ruleId: "rule-dining" });
    expect(
      interpretDeletion({ itemType: "budget", name: "Dining" }, sharedNameData).proposedAction
    ).toMatchObject({ kind: "BUDGET_DELETION", budgetId: "budget-dining" });
  });

  it("asks which one is meant when the name fits two kinds of thing and no kind was given", () => {
    const interpretation = interpretDeletion(
      { name: "Dining" },
      { ...GOAL_DATA, rules: [{ id: "rule-dining", merchant: "Dining", category: "Dining" }] }
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      '"Dining" could be your Dining budget or your rule for Dining. Which one should I delete?'
    );
  });

  it("sends the user to the item's page when two of the same kind share the name", () => {
    const interpretation = interpretDeletion(
      { itemType: "categorization rule", name: "costco" },
      {
        ...GOAL_DATA,
        rules: [
          { id: "rule-1", merchant: "Costco", category: "Groceries" },
          { id: "rule-2", merchant: "COSTCO", category: "Dining" },
        ],
      }
    );

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      'You have more than one categorization rule called "Costco", so I can\'t tell which one ' +
        "to delete. You can delete it from its page in Bloom."
    );
  });

  it("lists the user's items of that kind when the named one does not exist", () => {
    const interpretation = interpretDeletion({ itemType: "savings goal", name: "House" });

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      `You don't have a savings goal called "House". Yours are: Japan trip, Emergency fund.`
    );
  });

  it("says what can be deleted when asked to delete something else, like a transaction", () => {
    const interpretation = interpretDeletion({ itemType: "transaction", name: "Costco $54.20" });

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      `I couldn't find a budget, savings goal, or categorization rule called "Costco $54.20". ` +
        "I can delete a budget, a savings goal, or a categorization rule. Transactions, " +
        "accounts, and anything else have to be deleted from their own page in Bloom."
    );
  });

  it("asks what to delete when the model named nothing", () => {
    const interpretation = interpretDeletion({ itemType: "budget" });

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toBe(
      "Which budget, savings goal, or categorization rule should I delete?"
    );
  });
});

describe("interpretToolCall — unknown tools", () => {
  it("drafts nothing for a tool Bloom never offered", () => {
    const interpretation = interpret("delete_account", { accountId: "account-savings" });

    expect(interpretation.proposedAction).toBeNull();
    expect(interpretation.reply).toContain("I can draft a budget, a savings goal, or a");
  });
});

describe("selectUserMessagesSinceLastDraft", () => {
  const GROCERIES_DRAFT = {
    kind: "BUDGET" as const,
    category: "Groceries",
    monthlyLimit: 400,
    currentMonthlyLimit: null,
  };

  /** Builds a stored turn without a draft. */
  function plainMessage(role: "user" | "assistant", content: string) {
    return { role, content, proposedAction: null, proposedActionStatus: null };
  }

  it("returns every user message when no reply has carried a draft", () => {
    expect(
      selectUserMessagesSinceLastDraft([
        plainMessage("user", "I want a $300 budget"),
        plainMessage("assistant", "Which category?"),
        plainMessage("user", "Groceries"),
      ])
    ).toEqual(["I want a $300 budget", "Groceries"]);
  });

  it("returns only the user messages sent after the most recent draft", () => {
    expect(
      selectUserMessagesSinceLastDraft([
        plainMessage("user", "Set a $400 grocery budget"),
        {
          role: "assistant",
          content: "Drafted.",
          proposedAction: GROCERIES_DRAFT,
          proposedActionStatus: "DISMISSED",
        },
        plainMessage("user", "Make it $450"),
        {
          role: "assistant",
          content: "Drafted.",
          proposedAction: { ...GROCERIES_DRAFT, monthlyLimit: 450 },
          proposedActionStatus: "CONFIRMED",
        },
        plainMessage("user", "Create a goal for a trip"),
        plainMessage("assistant", "How much?"),
      ])
    ).toEqual(["Create a goal for a trip"]);
  });

  it("returns nothing when the conversation ends on a draft, or is empty", () => {
    expect(
      selectUserMessagesSinceLastDraft([
        plainMessage("user", "Set a $400 grocery budget"),
        {
          role: "assistant",
          content: "Drafted.",
          proposedAction: GROCERIES_DRAFT,
          proposedActionStatus: "PENDING",
        },
      ])
    ).toEqual([]);
    expect(selectUserMessagesSinceLastDraft([])).toEqual([]);
  });
});

describe("buildChatActionTools", () => {
  it("offers the user's own categories and accounts as the only choices", () => {
    const tools = buildChatActionTools(REFERENCE_DATA);
    const parametersByToolName = Object.fromEntries(
      tools.map((tool) => [tool.function.name, tool.function.parameters])
    );

    expect(Object.keys(parametersByToolName)).toEqual([
      "propose_budget",
      "propose_categorization_rule",
      "propose_savings_goal",
      "propose_deletion",
    ]);
    expect(parametersByToolName["propose_budget"]).toMatchObject({
      properties: { category: { enum: ["Dining", "Groceries", "Health & Fitness"] } },
      required: ["category", "monthlyLimit"],
    });
    expect(parametersByToolName["propose_categorization_rule"]).toMatchObject({
      properties: { category: { enum: ["Dining", "Groceries", "Health & Fitness", "Salary"] } },
      required: ["merchant", "category"],
    });
    expect(parametersByToolName["propose_savings_goal"]).toMatchObject({
      properties: { account: { enum: ["Everyday (Chequing)", "Rainy day (Savings)"] } },
      required: ["goalName", "targetAmount"],
    });
  });

  it("lists two accounts that share a label only once", () => {
    const tools = buildChatActionTools({
      ...REFERENCE_DATA,
      accounts: [
        { id: "account-1", name: "Thiha", accountType: "CHEQUING" },
        { id: "account-2", name: "Thiha", accountType: "CHEQUING" },
      ],
    });

    const goalTool = tools.find((tool) => tool.function.name === "propose_savings_goal");
    expect(goalTool!.function.parameters).toMatchObject({
      properties: { account: { enum: ["Thiha (Chequing)"] } },
    });
  });

  it("offers the goal change tool, with the user's goals as the only choices, once they have one", () => {
    const tools = buildChatActionTools(GOAL_DATA);
    const goalChangeTool = tools.find(
      (tool) => tool.function.name === "propose_savings_goal_change"
    );

    expect(goalChangeTool!.function).toMatchObject({
      name: "propose_savings_goal_change",
      parameters: {
        properties: {
          goal: { enum: ["Japan trip", "Emergency fund"] },
          account: { enum: ["Everyday (Chequing)", "Rainy day (Savings)"] },
        },
        required: ["goal"],
      },
    });
  });

  it("leaves the savings goal tool out for a user with no accounts", () => {
    const tools = buildChatActionTools({ ...REFERENCE_DATA, accounts: [] });

    expect(tools.map((tool) => tool.function.name)).toEqual([
      "propose_budget",
      "propose_categorization_rule",
      "propose_deletion",
    ]);
  });

  it("offers every budget, goal, and rule the user has as the only things to delete", () => {
    const tools = buildChatActionTools(GOAL_DATA);
    const deletionTool = tools.find((tool) => tool.function.name === "propose_deletion");

    expect(deletionTool!.function.parameters).toEqual({
      type: "object",
      properties: {
        itemType: { type: "string", enum: ["budget", "savings goal", "categorization rule"] },
        name: {
          type: "string",
          enum: ["Dining", "Japan trip", "Emergency fund", "Tim Hortons"],
          description: expect.any(String),
        },
      },
      required: ["itemType", "name"],
    });
  });

  it("offers only the kinds of thing the user has to delete, each name once", () => {
    const tools = buildChatActionTools({
      ...REFERENCE_DATA,
      budgets: [],
      rules: [
        { id: "rule-1", merchant: "Costco", category: "Groceries" },
        { id: "rule-2", merchant: "Costco", category: "Dining" },
      ],
    });
    const deletionTool = tools.find((tool) => tool.function.name === "propose_deletion");

    expect(deletionTool!.function.parameters).toMatchObject({
      properties: {
        itemType: { enum: ["categorization rule"] },
        name: { enum: ["Costco"] },
      },
    });
  });

  it("leaves the deletion tool out for a user with nothing it could delete", () => {
    const tools = buildChatActionTools({ ...REFERENCE_DATA, budgets: [], rules: [] });

    expect(tools.map((tool) => tool.function.name)).not.toContain("propose_deletion");
  });
});

describe("buildChatActionInstructions", () => {
  it("states today's date and that a draft is not saved until confirmed", () => {
    const instructions = buildChatActionInstructions(REFERENCE_DATA, TODAY);

    expect(instructions).toContain("today is 2026-10-12");
    expect(instructions).toContain("nothing is saved or deleted until they confirm it");
    expect(instructions).not.toContain("no accounts");
  });

  it("tells the model a goal cannot be drafted for a user with no accounts", () => {
    const instructions = buildChatActionInstructions({ ...REFERENCE_DATA, accounts: [] }, TODAY);

    expect(instructions).toContain("The user has no accounts in Bloom yet");
  });

  it("tells the model it cannot delete transactions or accounts and must not offer to", () => {
    const instructions = buildChatActionInstructions(REFERENCE_DATA, TODAY);

    expect(instructions).toContain("You cannot delete or change transactions or accounts");
    expect(instructions).toContain("never offer to do it yourself");
  });
});

describe("toModelMessages", () => {
  it("passes an ordinary message through unchanged", () => {
    expect(
      toModelMessages({
        role: "user",
        content: "What is a TFSA?",
        proposedAction: null,
        proposedActionStatus: null,
      })
    ).toEqual([{ role: "user", content: "What is a TFSA?" }]);
  });

  it.each([
    ["PENDING", "They have not confirmed or dismissed it yet, so nothing is saved."],
    ["CONFIRMED", "The user confirmed this draft and it was carried out."],
    ["DISMISSED", "The user dismissed this draft. Nothing was changed."],
  ] as const)(
    "replays a %s draft as its tool call, what became of it, then the reply",
    (status, outcome) => {
      const modelMessages = toModelMessages({
        role: "assistant",
        content: "I've drafted a monthly budget for Groceries.",
        proposedAction: {
          kind: "BUDGET",
          category: "Groceries",
          monthlyLimit: 400,
          currentMonthlyLimit: null,
        },
        proposedActionStatus: status,
      });

      expect(modelMessages).toEqual([
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              function: {
                name: "propose_budget",
                arguments: { category: "Groceries", monthlyLimit: 400 },
              },
            },
          ],
        },
        { role: "tool", content: expect.stringContaining(outcome) },
        { role: "assistant", content: "I've drafted a monthly budget for Groceries." },
      ]);
    }
  );

  it("replays a savings goal draft with its deadline and account", () => {
    const [toolCallMessage] = toModelMessages({
      role: "assistant",
      content: "Drafted.",
      proposedAction: {
        kind: "SAVINGS_GOAL",
        name: "Japan trip",
        targetAmount: 3000,
        targetDate: "2027-06-30",
        accountId: "account-savings",
        accountLabel: "Rainy day (Savings)",
      },
      proposedActionStatus: "CONFIRMED",
    });

    expect(toolCallMessage!.tool_calls).toEqual([
      {
        function: {
          name: "propose_savings_goal",
          arguments: {
            goalName: "Japan trip",
            targetAmount: 3000,
            targetDate: "2027-06-30",
            account: "Rainy day (Savings)",
          },
        },
      },
    ]);
  });

  it("leaves the deadline out of a replayed open-ended goal", () => {
    const [toolCallMessage] = toModelMessages({
      role: "assistant",
      content: "Drafted.",
      proposedAction: {
        kind: "SAVINGS_GOAL",
        name: "Emergency fund",
        targetAmount: 5000,
        targetDate: null,
        accountId: "account-savings",
        accountLabel: "Rainy day (Savings)",
      },
      proposedActionStatus: "PENDING",
    });

    expect(toolCallMessage!.tool_calls![0]!.function.arguments).not.toHaveProperty("targetDate");
  });

  it.each([
    [
      { kind: "BUDGET_DELETION" as const, budgetId: "b", category: "Dining", monthlyLimit: 150 },
      { itemType: "budget", name: "Dining" },
    ],
    [
      {
        kind: "SAVINGS_GOAL_DELETION" as const,
        goalId: "g",
        name: "Japan trip",
        targetAmount: 3000,
        targetDate: null,
        accountLabel: "Rainy day (Savings)",
      },
      { itemType: "savings goal", name: "Japan trip" },
    ],
    [
      {
        kind: "CATEGORIZATION_RULE_DELETION" as const,
        ruleId: "r",
        merchant: "Tim Hortons",
        category: "Dining",
      },
      { itemType: "categorization rule", name: "Tim Hortons" },
    ],
  ])("replays a %s draft as the deletion tool call it was", (proposedAction, expectedArguments) => {
    const [toolCallMessage] = toModelMessages({
      role: "assistant",
      content: "Drafted.",
      proposedAction,
      proposedActionStatus: "CONFIRMED",
    });

    expect(toolCallMessage!.tool_calls![0]!.function).toEqual({
      name: "propose_deletion",
      arguments: expectedArguments,
    });
  });

  it("replays a goal change with only the fields it changed", () => {
    const [toolCallMessage] = toModelMessages({
      role: "assistant",
      content: "Drafted.",
      proposedAction: {
        kind: "SAVINGS_GOAL_CHANGE",
        goalId: "goal-japan",
        currentName: "Japan trip",
        name: null,
        targetAmount: 4000,
        currentTargetAmount: 3000,
        targetDate: null,
        currentTargetDate: "2027-06-30",
        accountId: "account-chequing",
        accountLabel: "Everyday (Chequing)",
        currentAccountLabel: "Rainy day (Savings)",
      },
      proposedActionStatus: "CONFIRMED",
    });

    expect(toolCallMessage!.tool_calls![0]!.function).toEqual({
      name: "propose_savings_goal_change",
      arguments: { goal: "Japan trip", targetAmount: 4000, account: "Everyday (Chequing)" },
    });
  });

  it("replays a renamed goal with its new name and new deadline", () => {
    const [toolCallMessage] = toModelMessages({
      role: "assistant",
      content: "Drafted.",
      proposedAction: {
        kind: "SAVINGS_GOAL_CHANGE",
        goalId: "goal-japan",
        currentName: "Japan trip",
        name: "Tokyo trip",
        targetAmount: null,
        currentTargetAmount: 3000,
        targetDate: "2027-08-31",
        currentTargetDate: "2027-06-30",
        accountId: null,
        accountLabel: null,
        currentAccountLabel: "Rainy day (Savings)",
      },
      proposedActionStatus: "PENDING",
    });

    expect(toolCallMessage!.tool_calls![0]!.function.arguments).toEqual({
      goal: "Japan trip",
      newGoalName: "Tokyo trip",
      targetDate: "2027-08-31",
    });
  });

  it("replays a categorization rule draft with its merchant and category", () => {
    const [toolCallMessage] = toModelMessages({
      role: "assistant",
      content: "Drafted.",
      proposedAction: {
        kind: "CATEGORIZATION_RULE",
        merchant: "Tim Hortons",
        category: "Dining",
        currentCategory: null,
      },
      proposedActionStatus: "DISMISSED",
    });

    expect(toolCallMessage!.tool_calls).toEqual([
      {
        function: {
          name: "propose_categorization_rule",
          arguments: { merchant: "Tim Hortons", category: "Dining" },
        },
      },
    ]);
  });
});
