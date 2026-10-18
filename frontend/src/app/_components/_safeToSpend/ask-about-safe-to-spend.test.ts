import { describe, expect, it } from "vitest";
import type { SafeToSpendBillItem, SafeToSpendResult } from "@/lib/safe-to-spend";
import { buildSafeToSpendPrompt, MAX_BILLS_IN_PROMPT } from "./ask-about-safe-to-spend";

/** Builds a bill occurrence due on the given date. */
function makeBill(label: string, amount: number, date: string): SafeToSpendBillItem {
  return { key: `${label}-${date}`, label, amount, date };
}

/** Builds a safe-to-spend result with sensible defaults for the fields a test doesn't care about. */
function makeResult(overrides: Partial<SafeToSpendResult> = {}): SafeToSpendResult {
  return {
    availableCash: 1200,
    expectedIncome: 2000,
    upcomingBills: 2787.5,
    safeToSpend: 412.5,
    daysRemaining: 14,
    perDay: 29.46,
    billItems: [makeBill("Rent", 2000, "2026-10-31")],
    ...overrides,
  };
}

describe("buildSafeToSpendPrompt", () => {
  it("asks how to stretch a positive figure", () => {
    expect(buildSafeToSpendPrompt(makeResult())).toMatch(
      /^Why is my safe-to-spend \$412\.50 for the rest of the month, and how can I make it go further\?/
    );
  });

  it("lays out the full ledger, including the per-day amount", () => {
    const prompt = buildSafeToSpendPrompt(makeResult());
    expect(prompt).toContain("- Available cash in chequing and savings: $1,200.00");
    expect(prompt).toContain("- Expected income before month-end: $2,000.00");
    expect(prompt).toContain("- Bills still due before month-end: $2,787.50");
    expect(prompt).toContain("- Safe to spend: $412.50, about $29.46 a day for the 14 days left");
  });

  it("leaves expected income out when none is coming", () => {
    expect(buildSafeToSpendPrompt(makeResult({ expectedIncome: 0 }))).not.toContain(
      "Expected income"
    );
  });

  it("asks what to do about a negative figure and drops the per-day amount", () => {
    const prompt = buildSafeToSpendPrompt(
      makeResult({ safeToSpend: -300, perDay: 0, daysRemaining: 1 })
    );
    expect(prompt).toMatch(
      /^Why is my safe-to-spend -\$300\.00 for the rest of the month, and what should I do about it\?/
    );
    expect(prompt).toContain("- Safe to spend: -$300.00, with 1 day left this month");
    expect(prompt).not.toContain("a day for the");
  });

  it("treats exactly zero as nothing free to spend", () => {
    expect(buildSafeToSpendPrompt(makeResult({ safeToSpend: 0, perDay: 0 }))).toContain(
      "what should I do about it?"
    );
  });

  it("lists bills by name, amount, and date", () => {
    expect(buildSafeToSpendPrompt(makeResult())).toContain(
      "Bills still due:\n- Rent: $2,000.00 on Oct 31"
    );
  });

  it("summarises bills beyond the listed few", () => {
    const billItems = Array.from({ length: MAX_BILLS_IN_PROMPT + 2 }, (_, index) =>
      makeBill(`Bill ${index + 1}`, 10, "2026-10-20")
    );
    const prompt = buildSafeToSpendPrompt(makeResult({ billItems }));
    expect(prompt).toContain(`- Bill ${MAX_BILLS_IN_PROMPT}:`);
    expect(prompt).not.toContain(`- Bill ${MAX_BILLS_IN_PROMPT + 1}:`);
    expect(prompt).toContain("- plus 2 more bills");
  });

  it("uses the singular for one unlisted bill", () => {
    const billItems = Array.from({ length: MAX_BILLS_IN_PROMPT + 1 }, (_, index) =>
      makeBill(`Bill ${index + 1}`, 10, "2026-10-20")
    );
    expect(buildSafeToSpendPrompt(makeResult({ billItems }))).toContain("- plus 1 more bill");
  });

  it("omits the bill list when nothing is due", () => {
    expect(buildSafeToSpendPrompt(makeResult({ billItems: [] }))).not.toContain("Bills still due:");
  });
});
