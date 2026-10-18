import { describe, expect, it } from "vitest";
import type { AutoCategorizationRule, QuickAddDraft } from "@/lib/api";
import {
  describeQuickAddFill,
  toQuickAddFormValues,
  type QuickAddFormContext,
} from "./quick-add-draft";

const COFFEE_DRAFT: QuickAddDraft = {
  direction: "EXPENSE",
  amount: 4.5,
  merchant: "Tim Hortons",
  category: "Dining",
  date: "2026-10-16",
};

const CHEQUING_CONTEXT: QuickAddFormContext = {
  accountType: "CHEQUING",
  categorizationRules: [],
  incomeCategoryNames: ["Salary", "Other Income"],
  expenseCategoryNames: ["Dining", "Groceries"],
};

describe("toQuickAddFormValues", () => {
  it("fills a withdrawal from an expense on an everyday account", () => {
    expect(toQuickAddFormValues(COFFEE_DRAFT, CHEQUING_CONTEXT)).toEqual({
      op: "withdraw",
      amount: "4.50",
      merchant: "Tim Hortons",
      category: "Dining",
      date: "2026-10-16",
    });
  });

  it("fills a deposit from income on an everyday account", () => {
    const paycheque: QuickAddDraft = {
      direction: "INCOME",
      amount: 2150,
      merchant: null,
      category: "Salary",
      date: "2026-10-17",
    };

    expect(toQuickAddFormValues(paycheque, CHEQUING_CONTEXT)).toMatchObject({
      op: "deposit",
      amount: "2150.00",
      merchant: "",
      category: "Salary",
    });
  });

  it("fills a charge from an expense on a credit card", () => {
    expect(
      toQuickAddFormValues(COFFEE_DRAFT, { ...CHEQUING_CONTEXT, accountType: "CREDIT" })
    ).toMatchObject({ op: "deposit", category: "Dining" });
  });

  it("fills a payment from income on a credit card, leaving out an income category it can't hold", () => {
    const refund: QuickAddDraft = {
      ...COFFEE_DRAFT,
      direction: "INCOME",
      category: "Other Income",
    };

    expect(
      toQuickAddFormValues(refund, { ...CHEQUING_CONTEXT, accountType: "CREDIT" })
    ).toMatchObject({ op: "withdraw", category: "" });
  });

  it("uses the user's rule for the merchant over the model's category, ignoring case", () => {
    const rules = [
      { id: "r-1", merchant: "tim hortons", category: "Groceries" } as AutoCategorizationRule,
    ];

    expect(
      toQuickAddFormValues(COFFEE_DRAFT, { ...CHEQUING_CONTEXT, categorizationRules: rules })
        .category
    ).toBe("Groceries");
  });

  it("leaves the amount, merchant, and category blank when the note gave none", () => {
    const vagueDraft: QuickAddDraft = {
      direction: "EXPENSE",
      amount: null,
      merchant: null,
      category: null,
      date: "2026-10-17",
    };

    expect(toQuickAddFormValues(vagueDraft, CHEQUING_CONTEXT)).toMatchObject({
      amount: "",
      merchant: "",
      category: "",
    });
  });
});

describe("describeQuickAddFill", () => {
  it("asks the user to check the filled form", () => {
    expect(describeQuickAddFill(toQuickAddFormValues(COFFEE_DRAFT, CHEQUING_CONTEXT))).toBe(
      "Filled in from your note. Check it, then save."
    );
  });

  it("asks for the amount when the note had none", () => {
    const values = toQuickAddFormValues({ ...COFFEE_DRAFT, amount: null }, CHEQUING_CONTEXT);

    expect(describeQuickAddFill(values)).toBe(
      "Your note had no amount. Enter it below, then check the rest."
    );
  });
});
