import { describe, expect, it, vi } from "vitest";
import type { Account, MonthlySummary, NetWorthSnapshot } from "@/lib/api";
import { ALL_CARD_IDS, type CardId } from "@/components/dashboard-visibility-provider";
import { buildDashboardCards, type DashboardCardInputs } from "./buildDashboardCards";

// Only the card list is under test, so the card components themselves are never rendered.

const ACCOUNT = { id: "account-1", accountType: "CHEQUING", balance: 100 } as Account;
const SUMMARY = { month: "2026-04", income: 0, spending: 0 } as unknown as MonthlySummary;
const SNAPSHOT = { month: "2026-04" } as unknown as NetWorthSnapshot;

/** Builds inputs with every card visible and all data present, overridable per test. */
function makeInputs(overrides: Partial<DashboardCardInputs> = {}): DashboardCardInputs {
  return {
    visibleCards: new Set<CardId>(ALL_CARD_IDS),
    accounts: [ACCOUNT],
    budgets: [],
    monthlySummary: SUMMARY,
    previousMonthlySummary: null,
    monthlyTrends: [],
    netWorthHistory: [SNAPSHOT],
    recurringRules: [],
    goals: [],
    manualEntries: [],
    profile: null,
    rangeQuery: undefined,
    isCurrentMonth: true,
    newlyCreatedAccountId: null,
    onChanged: vi.fn(),
    ...overrides,
  };
}

/** The ids of the cards built from `inputs`, in order. */
function cardIds(inputs: DashboardCardInputs): CardId[] {
  return buildDashboardCards(inputs).map((card) => card.id);
}

describe("buildDashboardCards", () => {
  it("builds every visible card in the default order when all data exists", () => {
    expect(cardIds(makeInputs())).toEqual([
      "safe-to-spend",
      "goals",
      "financial-health",
      "insights",
      "budget-rule",
      "monthly-snapshot",
      "budgets",
      "recurring",
      "calendar",
      "net-worth",
      "manual-entries",
      "account-balances",
    ]);
  });

  it("leaves out cards the user has hidden", () => {
    const visibleCards = new Set<CardId>(["goals", "net-worth"]);

    expect(cardIds(makeInputs({ visibleCards }))).toEqual(["goals", "net-worth"]);
  });

  it("drops the analysis cards until this period's summary has loaded", () => {
    expect(cardIds(makeInputs({ monthlySummary: null }))).toEqual([
      "recurring",
      "calendar",
      "net-worth",
      "manual-entries",
      "account-balances",
    ]);
  });

  it("shows only manual entries and net worth history to a user with no accounts", () => {
    expect(cardIds(makeInputs({ accounts: [] }))).toEqual(["net-worth", "manual-entries"]);
  });

  it("hides net worth history until a snapshot exists", () => {
    expect(cardIds(makeInputs({ netWorthHistory: [] }))).not.toContain("net-worth");
  });

  it("anchors the budgets and balances cards so onboarding links can scroll to them", () => {
    const cards = buildDashboardCards(makeInputs());

    expect(cards.find((card) => card.id === "budgets")?.anchorId).toBe("budgets-card-section");
    expect(cards.find((card) => card.id === "account-balances")?.anchorId).toBe(
      "account-balances-anchor"
    );
  });
});
