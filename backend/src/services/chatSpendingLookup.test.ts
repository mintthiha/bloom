import { describe, expect, it } from "vitest";
import type { ChatActionReferenceData } from "./chatActionProposals";
import {
  buildSpendingLookupTool,
  formatSpendingAnswer,
  interpretSpendingLookup,
  toSpendingLookupModelMessages,
  type SpendingLookupQuery,
} from "./chatSpendingLookup";

const TODAY = new Date("2026-10-17T15:00:00.000Z");

const REFERENCE_DATA: ChatActionReferenceData = {
  expenseCategoryNames: ["Dining", "Groceries"],
  incomeCategoryNames: ["Salary"],
  accounts: [{ id: "account-everyday", name: "Everyday", accountType: "CHEQUING" }],
  budgets: [],
  rules: [],
  savingsGoals: [],
};

/** Reads the model's arguments for a question the user typed, as of the fixed test date. */
function interpret(
  toolArguments: Record<string, unknown>,
  question: string,
  earlierUserMessages: string[] = []
) {
  return interpretSpendingLookup(toolArguments, {
    referenceData: REFERENCE_DATA,
    today: TODAY,
    question,
    earlierUserMessages,
  });
}

/** The UTC midnight starting a day, for comparing period bounds. */
function utcDay(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

describe("interpretSpendingLookup — what to add up", () => {
  it("looks up a merchant the user named, and a category that is theirs, ignoring case", () => {
    const interpretation = interpret(
      { merchant: "Tim Hortons", category: "dining", period: "last month" },
      "How much did I spend at tim hortons on dining last month?"
    );

    expect(interpretation).toEqual({
      reply: null,
      query: {
        merchant: "Tim Hortons",
        category: "Dining",
        start: utcDay("2026-09-01"),
        end: utcDay("2026-10-01"),
        periodLabel: "in September 2026",
      },
      lookupArguments: { merchant: "Tim Hortons", category: "Dining", period: "last month" },
    });
  });

  it("accepts a merchant the user named earlier in the same request", () => {
    const interpretation = interpret({ merchant: "Costco" }, "and this month?", [
      "How much do I spend at Costco?",
    ]);

    expect(interpretation.query?.merchant).toBe("Costco");
  });

  it("asks which store when the model named one the user never mentioned", () => {
    const interpretation = interpret({ merchant: "Starbucks" }, "How much do I spend on coffee?");

    expect(interpretation).toEqual({
      query: null,
      reply: "Which store do you mean? Tell me its name as it shows on your transactions.",
      lookupArguments: { merchant: "Starbucks" },
    });
  });

  it("lists the user's spending categories when the model named one they don't have", () => {
    const interpretation = interpret({ category: "Coffee" }, "How much on coffee?");

    expect(interpretation).toEqual({
      query: null,
      reply: `"Coffee" isn't one of your spending categories. Yours are: Dining, Groceries.`,
      lookupArguments: { category: "Coffee" },
    });
  });

  it("drops a category the user never mentioned from a question about a store", () => {
    const interpretation = interpret(
      { merchant: "Costco", category: "Groceries", period: "this year" },
      "Add up my Costco purchases this year"
    );

    expect(interpretation.query).toMatchObject({ merchant: "Costco", category: null });
    expect(interpretation.lookupArguments).toEqual({ merchant: "Costco", period: "this year" });
  });

  it("asks which category when the model picked one the user never mentioned", () => {
    expect(interpret({ category: "Dining" }, "How much do I spend eating out?")).toEqual({
      query: null,
      reply: "Which of your spending categories do you mean? Yours are: Dining, Groceries.",
      lookupArguments: { category: "Dining" },
    });
  });

  it.each([
    ["by its singular", "How much went on grocery shopping?"],
    ["in an earlier message", "and last month?", ["What did I spend on groceries?"]],
  ])("accepts a category the user mentioned %s", (_, question, earlierUserMessages = []) => {
    expect(
      interpret({ category: "Groceries" }, question, earlierUserMessages).query?.category
    ).toBe("Groceries");
  });

  it("adds up everything when neither a merchant nor a category was given", () => {
    const interpretation = interpret({}, "How much have I spent?");

    expect(interpretation.query).toMatchObject({ merchant: null, category: null });
  });
});

describe("interpretSpendingLookup — the period", () => {
  it.each([
    ["this month", "2026-10-01", "2026-11-01", "so far in October 2026"],
    ["last month", "2026-09-01", "2026-10-01", "in September 2026"],
    ["last 3 months", "2026-08-01", "2026-11-01", "since August 1, 2026"],
    ["this year", "2026-01-01", "2027-01-01", "so far in 2026"],
    ["last year", "2025-01-01", "2026-01-01", "in 2025"],
  ])("resolves %s against today", (period, expectedStart, expectedEnd, expectedLabel) => {
    expect(interpret({ period }, "How much did I spend?").query).toMatchObject({
      start: utcDay(expectedStart),
      end: utcDay(expectedEnd),
      periodLabel: expectedLabel,
    });
  });

  it("covers every transaction for all time", () => {
    const query = interpret({ period: "all time" }, "How much have I ever spent?").query!;

    expect(query.start).toEqual(new Date(0));
    expect(query.end.getUTCFullYear()).toBe(9999);
    expect(query.periodLabel).toBe("across all your history");
  });

  it("takes this month when the model gave no period, or one it was never offered", () => {
    for (const toolArguments of [{}, { period: "the past fortnight" }]) {
      expect(interpret(toolArguments, "How much did I spend?").query).toMatchObject({
        start: utcDay("2026-10-01"),
        periodLabel: "so far in October 2026",
      });
    }
  });

  it.each([
    ["this year", "Add up my Costco purchases this year", "2026-01-01", "so far in 2026"],
    ["last month", "What did I spend on groceries last month?", "2026-09-01", "in September 2026"],
    ["last 3 months", "How much over the past three months?", "2026-08-01", "since August 1, 2026"],
    ["last year", "What about the previous year?", "2025-01-01", "in 2025"],
    ["all time", "How much have I ever spent there?", "1970-01-01", "across all your history"],
  ])(
    "takes %s from the question when the model left the period out",
    (period, question, expectedStart, expectedLabel) => {
      const interpretation = interpret({}, question);

      expect(interpretation.query).toMatchObject({
        start: utcDay(expectedStart),
        periodLabel: expectedLabel,
      });
      expect(interpretation.lookupArguments).toEqual({ period });
    }
  );

  it("takes the question's period over a different one the model sent", () => {
    expect(
      interpret({ period: "this month" }, "How much did I spend last month?").query
    ).toMatchObject({ periodLabel: "in September 2026" });
  });

  it("takes the question's period over a month the question never named", () => {
    expect(interpret({ month: "2026-10" }, "How much this year?").query).toMatchObject({
      periodLabel: "so far in 2026",
    });
  });

  it("keeps a month the question names, alongside a period it also names", () => {
    const interpretation = interpret({ month: "2025-09" }, "How much in Sept last year?");

    expect(interpretation.query).toMatchObject({ periodLabel: "in September 2025" });
    expect(interpretation.lookupArguments).toEqual({ month: "2025-09" });
  });

  it("stores a month the model sent by name as YYYY-MM", () => {
    expect(interpret({ month: "September" }, "In September?").lookupArguments).toEqual({
      month: "2026-09",
    });
  });

  it("uses a specific month over a named period", () => {
    const query = interpret({ month: "2026-02", period: "this year" }, "February?").query;

    expect(query).toMatchObject({
      start: utcDay("2026-02-01"),
      end: utcDay("2026-03-01"),
      periodLabel: "in February 2026",
    });
  });

  it("rolls a December month over into the next year", () => {
    expect(interpret({ month: "2025-12" }, "December?").query).toMatchObject({
      start: utcDay("2025-12-01"),
      end: utcDay("2026-01-01"),
    });
  });

  it.each([
    ["September", "2026-09-01", "in September 2026"],
    ["sept", "2026-09-01", "in September 2026"],
    ["October", "2026-10-01", "in October 2026"],
    ["November", "2025-11-01", "in November 2025"],
    ["March 2025", "2025-03-01", "in March 2025"],
  ])("reads the month name %j as its most recent occurrence", (month, expectedStart, label) => {
    expect(interpret({ month }, "That month?").query).toMatchObject({
      start: utcDay(expectedStart),
      periodLabel: label,
    });
  });

  it.each(["2026-13", "2026-9", "next summer", "Ma"])(
    "asks which month when the model sent %j",
    (month) => {
      expect(interpret({ month }, "September?")).toEqual({
        query: null,
        reply: "Which month do you mean? For example, September 2026.",
        lookupArguments: { month },
      });
    }
  );

  it("says a month in the future hasn't happened yet", () => {
    expect(interpret({ month: "2026-11" }, "November?")).toEqual({
      query: null,
      reply: "November 2026 hasn't happened yet.",
      lookupArguments: { month: "2026-11" },
    });
  });
});

describe("formatSpendingAnswer", () => {
  const SEPTEMBER = {
    start: utcDay("2026-09-01"),
    end: utcDay("2026-10-01"),
    periodLabel: "in September 2026",
  };

  /** Builds a query for September with the given merchant and category. */
  function septemberQuery(merchant: string | null, category: string | null): SpendingLookupQuery {
    return { merchant, category, ...SEPTEMBER };
  }

  it("gives the total, the count, and the largest purchase for a merchant", () => {
    expect(
      formatSpendingAnswer(septemberQuery("Tim Hortons", null), {
        total: 19,
        purchaseCount: 2,
        largestPurchase: { amount: 14.5, effectiveAt: utcDay("2026-09-12"), label: "Tim Hortons" },
      })
    ).toBe(
      "You spent $19.00 at Tim Hortons in September 2026, across 2 purchases. The largest was " +
        "$14.50 on Sep 12."
    );
  });

  it("says where the largest purchase was when the question wasn't about one store", () => {
    expect(
      formatSpendingAnswer(septemberQuery(null, "Dining"), {
        total: 1204.5,
        purchaseCount: 3,
        largestPurchase: { amount: 88, effectiveAt: utcDay("2026-09-14"), label: "The Keg" },
      })
    ).toBe(
      "You spent $1,204.50 on Dining in September 2026, across 3 purchases. The largest was " +
        "$88.00 at The Keg on Sep 14."
    );
  });

  it("names both the store and the category, or neither", () => {
    const onePurchase = {
      total: 4.5,
      purchaseCount: 1,
      largestPurchase: { amount: 4.5, effectiveAt: utcDay("2026-09-03"), label: "Tim Hortons" },
    };

    expect(formatSpendingAnswer(septemberQuery("Tim Hortons", "Dining"), onePurchase)).toBe(
      "You spent $4.50 at Tim Hortons on Dining in September 2026, across 1 purchase."
    );
    expect(formatSpendingAnswer(septemberQuery(null, null), onePurchase)).toBe(
      "You spent $4.50 in September 2026, across 1 purchase."
    );
  });

  it("leaves out where the largest purchase was when it has no label", () => {
    expect(
      formatSpendingAnswer(septemberQuery(null, null), {
        total: 30,
        purchaseCount: 2,
        largestPurchase: { amount: 20, effectiveAt: utcDay("2026-09-05"), label: null },
      })
    ).toBe(
      "You spent $30.00 in September 2026, across 2 purchases. The largest was $20.00 on Sep 5."
    );
  });

  it("says nothing was found, and suggests another spelling for a store", () => {
    const nothing = { total: 0, purchaseCount: 0, largestPurchase: null };

    expect(formatSpendingAnswer(septemberQuery("Starbucks", null), nothing)).toBe(
      "I couldn't find any spending at Starbucks in September 2026. If the name looks " +
        "different on your statement, try that spelling."
    );
    expect(formatSpendingAnswer(septemberQuery(null, "Dining"), nothing)).toBe(
      "I couldn't find any spending on Dining in September 2026."
    );
  });
});

describe("buildSpendingLookupTool", () => {
  it("offers the user's spending categories and the named periods, with nothing required", () => {
    expect(buildSpendingLookupTool(REFERENCE_DATA).function).toMatchObject({
      name: "look_up_spending",
      parameters: {
        properties: {
          category: { enum: ["Dining", "Groceries"] },
          period: {
            enum: [
              "this month",
              "last month",
              "last 3 months",
              "this year",
              "last year",
              "all time",
            ],
          },
        },
        required: [],
      },
    });
  });

  it("offers no category choices to a user with no spending categories", () => {
    const tool = buildSpendingLookupTool({ ...REFERENCE_DATA, expenseCategoryNames: [] });

    expect(tool.function.parameters).toMatchObject({
      properties: { category: { type: "string" } },
    });
    expect(tool.function.parameters).not.toHaveProperty("properties.category.enum");
  });
});

describe("toSpendingLookupModelMessages", () => {
  it("replays a stored answer as the lookup call, its result, and the answer", () => {
    const answer = "You spent $19.00 at Tim Hortons in September 2026, across 2 purchases.";

    expect(
      toSpendingLookupModelMessages(answer, { merchant: "Tim Hortons", month: "2026-09" })
    ).toEqual([
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            function: {
              name: "look_up_spending",
              arguments: { merchant: "Tim Hortons", month: "2026-09" },
            },
          },
        ],
      },
      { role: "tool", content: answer },
      { role: "assistant", content: answer },
    ]);
  });
});
