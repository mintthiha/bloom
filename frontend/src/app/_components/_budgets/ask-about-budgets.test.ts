import { describe, expect, it } from "vitest";
import type { Budget } from "@/lib/api";
import { buildBudgetsPrompt, MAX_BUDGETS_IN_PROMPT } from "./ask-about-budgets";

const OCTOBER_17 = new Date(2026, 9, 17);

/** Builds a budget with the figures the prompt reads, deriving remaining/over from spent and available. */
function makeBudget(category: string, currentSpending: number, available: number): Budget {
  const remaining = available - currentSpending;
  return {
    id: category,
    category,
    currentSpending,
    available,
    remaining,
    percentageUsed: available > 0 ? Math.round((currentSpending / available) * 100) : 0,
    isOverBudget: remaining < 0,
  } as Budget;
}

describe("buildBudgetsPrompt", () => {
  it("asks which budgets need attention", () => {
    expect(buildBudgetsPrompt([makeBudget("Dining", 100, 250)], OCTOBER_17)).toMatch(
      /^Which of my budgets need the most attention this month, and what should I do about them\?/
    );
  });

  it("says how far through the month it is", () => {
    expect(buildBudgetsPrompt([makeBudget("Dining", 100, 250)], OCTOBER_17)).toContain(
      "It's day 17 of 31 this month."
    );
    expect(buildBudgetsPrompt([makeBudget("Dining", 100, 250)], new Date(2026, 1, 3))).toContain(
      "It's day 3 of 28 this month."
    );
  });

  it("describes over-limit and within-limit budgets, most-used first", () => {
    const prompt = buildBudgetsPrompt(
      [makeBudget("Groceries", 380, 400), makeBudget("Dining", 320, 250)],
      OCTOBER_17
    );
    expect(prompt).toContain(
      "- Dining: $320.00 of $250.00 (128%), over by $70.00\n- Groceries: $380.00 of $400.00 (95%), $20.00 left"
    );
  });

  it("summarises how many budgets are over the limit", () => {
    expect(
      buildBudgetsPrompt(
        [makeBudget("Dining", 320, 250), makeBudget("Groceries", 380, 400)],
        OCTOBER_17
      )
    ).toContain("1 of 2 budgets is over the limit.");
    expect(
      buildBudgetsPrompt(
        [makeBudget("Dining", 320, 250), makeBudget("Fun", 90, 50), makeBudget("Gas", 10, 100)],
        OCTOBER_17
      )
    ).toContain("2 of 3 budgets are over the limit.");
  });

  it("says when every budget is within its limit", () => {
    expect(
      buildBudgetsPrompt(
        [makeBudget("Dining", 100, 250), makeBudget("Groceries", 50, 400)],
        OCTOBER_17
      )
    ).toContain("All 2 budgets are within their limit.");
  });

  it("phrases a single within-limit budget in the singular", () => {
    expect(buildBudgetsPrompt([makeBudget("Dining", 100, 250)], OCTOBER_17)).toContain(
      "My one budget is within its limit."
    );
  });

  it("treats spending exactly at the limit as within it", () => {
    const prompt = buildBudgetsPrompt([makeBudget("Dining", 250, 250)], OCTOBER_17);
    expect(prompt).toContain("- Dining: $250.00 of $250.00 (100%), $0.00 left");
    expect(prompt).toContain("within its limit");
  });

  it("lists only the most-used budgets and summarises the rest", () => {
    const budgets = Array.from({ length: MAX_BUDGETS_IN_PROMPT + 3 }, (_, index) =>
      makeBudget(`Category ${index + 1}`, index + 1, 100)
    );
    const prompt = buildBudgetsPrompt(budgets, OCTOBER_17);
    expect(prompt).toContain(`- Category ${MAX_BUDGETS_IN_PROMPT + 3}:`);
    expect(prompt).not.toContain("- Category 1:");
    expect(prompt).toContain("- plus 3 more budgets");
    // The summary still counts every budget, not just the listed ones.
    expect(prompt).toContain(`All ${MAX_BUDGETS_IN_PROMPT + 3} budgets are within their limit.`);
  });
});
