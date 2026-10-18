import { describe, expect, it } from "vitest";
import {
  buildQuickAddSystemPrompt,
  interpretQuickAddReply,
  isDateOnly,
  type QuickAddCategories,
} from "./quickAddParsing";

// A Saturday.
const TODAY = "2026-10-17";

const CATEGORIES: QuickAddCategories = {
  expenseCategoryNames: ["Dining", "Groceries", "Transport"],
  incomeCategoryNames: ["Salary", "Gift"],
};

/** Reads a model reply, given as an object, for a note typed on the fixed test date. */
function interpret(reply: Record<string, unknown>, note: string) {
  return interpretQuickAddReply(JSON.stringify(reply), {
    note,
    today: TODAY,
    categories: CATEGORIES,
  });
}

describe("interpretQuickAddReply — a well-formed reply", () => {
  it("reads the example note into a full draft", () => {
    expect(
      interpret(
        {
          type: "expense",
          amount: 4.5,
          merchant: "Tim Hortons",
          category: "Dining",
          date: "2026-10-16",
        },
        "Coffee 4.50 at Tim's yesterday"
      )
    ).toEqual({
      direction: "EXPENSE",
      amount: 4.5,
      merchant: "Tim Hortons",
      category: "Dining",
      date: "2026-10-16",
    });
  });

  it("reads income, matching its category to the user's own ignoring case", () => {
    expect(
      interpret({ type: "Income", amount: 2150, category: "salary" }, "paycheque 2,150 today")
    ).toMatchObject({ direction: "INCOME", amount: 2150, category: "Salary" });
  });

  it("takes anything but income to be an expense", () => {
    expect(interpret({ type: "transfer" }, "something").direction).toBe("EXPENSE");
    expect(interpret({}, "something").direction).toBe("EXPENSE");
  });
});

describe("interpretQuickAddReply — the amount", () => {
  it.each([
    ["a number the note has", 182.4, "costco 182.40", 182.4],
    ["an amount written with a dollar sign and commas", "$1,200", "rent $1,200", 1200],
    ["a whole-dollar amount", 45, "refund from amazon 45", 45],
  ])("keeps %s", (_, amount, note, expected) => {
    expect(interpret({ amount }, note).amount).toBe(expected);
  });

  it.each([
    ["an amount the note never gave", 3.25, "coffee at Tim's"],
    ["zero", 0, "coffee 0"],
    ["a non-number", "lots", "coffee lots"],
    ["an amount past the cap", 2_000_000, "house 2000000"],
  ])("leaves out %s", (_, amount, note) => {
    expect(interpret({ amount }, note).amount).toBeNull();
  });
});

describe("interpretQuickAddReply — the amount when the model gives none it can use", () => {
  it.each([
    ["a bare number the model skipped", null, "dinner at the keg 88 on friday", 88],
    ["the typed number over a negative one", -4.5, "coffee 4.50", 4.5],
    ["the one number besides a day count", null, "netflix 16.99 3 days ago", 16.99],
    ["the one number besides a written date", null, "gas 60 oct 3", 60],
    ["the one number besides a day-first date", null, "gas 60 on 3rd of October", 60],
    ["the one number besides a slashed date", null, "gas 60 on 10/03", 60],
    ["the one number besides an ISO date", null, "gas 60 on 2026-10-03", 60],
    ["a number after a word that only starts like a month", null, "farmers market 12", 12],
  ])("takes %s", (_, amount, note, expected) => {
    expect(interpret({ amount }, note).amount).toBe(expected);
  });

  it("doesn't take a date's number for the amount", () => {
    expect(interpret({ amount: 3 }, "gas oct 3").amount).toBeNull();
  });

  it("doesn't pick between two numbers", () => {
    expect(interpret({ amount: null }, "2 coffees 9.50").amount).toBeNull();
  });
});

describe("interpretQuickAddReply — the merchant", () => {
  it.each([
    ["a nickname the note used", "Tim Hortons", "coffee at tim's"],
    ["a name starting with a filler word", "The Keg", "dinner at the keg 88"],
    ["a short name that appears whole", "A&W", "a&w burger 9"],
  ])("keeps %s", (_, merchant, note) => {
    expect(interpret({ merchant }, note).merchant).toBe(merchant);
  });

  it.each([
    ["a business the note never named", "Restaurant", "lunch with sam"],
    ["a name matching only on a filler word", "The Restaurant", "lunch at the office"],
    ["an empty name", "  ", "coffee"],
  ])("drops %s", (_, merchant, note) => {
    expect(interpret({ merchant }, note).merchant).toBeNull();
  });
});

describe("interpretQuickAddReply — the category", () => {
  it("drops a category the user doesn't have", () => {
    expect(interpret({ category: "Coffee" }, "coffee 4").category).toBeNull();
  });

  it("drops an expense category on income, and an income category on an expense", () => {
    expect(interpret({ type: "income", category: "Dining" }, "refund 4").category).toBeNull();
    expect(interpret({ type: "expense", category: "Gift" }, "present 40").category).toBeNull();
  });
});

describe("interpretQuickAddReply — the date", () => {
  it.each([
    ["today", "2026-10-17"],
    ["tonight", "2026-10-17"],
    ["yesterday", "2026-10-16"],
    ["last night", "2026-10-16"],
    ["the day before yesterday", "2026-10-15"],
    ["3 days ago", "2026-10-14"],
    ["a day ago", "2026-10-16"],
    ["two days ago", "2026-10-15"],
    ["on Monday", "2026-10-12"],
    ["friday", "2026-10-16"],
    ["last saturday", "2026-10-10"],
  ])("works out %j itself, over the model's date", (when, expected) => {
    expect(interpret({ date: "2026-01-01" }, `coffee 4 ${when}`).date).toBe(expected);
  });

  it("works across a month boundary", () => {
    const interpretation = interpretQuickAddReply("{}", {
      note: "coffee yesterday",
      today: "2026-03-01",
      categories: CATEGORIES,
    });
    expect(interpretation.date).toBe("2026-02-28");
  });

  it("takes the model's date for a written-out day", () => {
    expect(interpret({ date: "2026-10-03" }, "gas $60 oct 3").date).toBe("2026-10-03");
  });

  it.each([
    ["no date", undefined],
    ["a future date", "2026-10-18"],
    ["a date more than two years back", "2024-10-16"],
    ["a day that doesn't exist", "2026-02-30"],
    ["something that isn't a date", "last week"],
  ])("uses today when the model gave %s", (_, date) => {
    expect(interpret({ date }, "coffee 4").date).toBe(TODAY);
  });
});

describe("interpretQuickAddReply — a broken reply", () => {
  it("rejects a reply that isn't JSON", () => {
    expect(() =>
      interpretQuickAddReply("Sure! Here it is", {
        note: "coffee",
        today: TODAY,
        categories: CATEGORIES,
      })
    ).toThrow(expect.objectContaining({ statusCode: 502 }));
  });

  it.each([["[]"], ["null"], ["4.5"]])("rejects the JSON value %s", (content) => {
    expect(() =>
      interpretQuickAddReply(content, { note: "coffee", today: TODAY, categories: CATEGORIES })
    ).toThrow(expect.objectContaining({ statusCode: 502 }));
  });
});

describe("buildQuickAddSystemPrompt", () => {
  it("gives today with its weekday and offers only the user's categories", () => {
    const prompt = buildQuickAddSystemPrompt(CATEGORIES, TODAY);

    expect(prompt).toContain("Today is Saturday, 2026-10-17.");
    expect(prompt).toContain("exactly one of: Dining, Groceries, Transport.");
    expect(prompt).toContain("exactly one of: Salary, Gift.");
  });

  it("says so when the user has no categories of a kind", () => {
    const prompt = buildQuickAddSystemPrompt(
      { expenseCategoryNames: [], incomeCategoryNames: ["Salary"] },
      TODAY
    );

    expect(prompt).toContain("for an expense, exactly one of: (none).");
  });
});

describe("isDateOnly", () => {
  it.each([
    ["2026-10-17", true],
    ["2024-02-29", true],
    ["2026-02-29", false],
    ["2026-13-01", false],
    ["2026-1-01", false],
    ["October 17", false],
  ])("treats %j as a date: %s", (value, expected) => {
    expect(isDateOnly(value)).toBe(expected);
  });
});
