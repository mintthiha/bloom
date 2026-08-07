import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DashboardVisibilityProvider,
  useDashboardVisibility,
  DEFAULT_VISIBLE_CARDS,
  ALL_CARD_IDS,
} from "./dashboard-visibility-provider";

const STORAGE_KEY = "bloom_dashboard_visible_cards";
const EXPLAINED_KEY = "bloom_dashboard_explained_cards";
const ORDER_KEY = "bloom_dashboard_card_order";

/** Renders the provider hook; state settles from localStorage on mount. */
function renderProvider() {
  return renderHook(() => useDashboardVisibility(), {
    wrapper: ({ children }) => (
      <DashboardVisibilityProvider>{children}</DashboardVisibilityProvider>
    ),
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("DashboardVisibilityProvider", () => {
  it("starts new users on the lean default card set", () => {
    const { result } = renderProvider();
    expect(result.current.visibleCards).toEqual(new Set(DEFAULT_VISIBLE_CARDS));
  });

  it("hydrates the stored visibility set and always includes account-balances", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["insights"]));
    const { result } = renderProvider();
    expect(result.current.visibleCards.has("insights")).toBe(true);
    expect(result.current.visibleCards.has("account-balances")).toBe(true);
  });

  it("enabling a card for the first time queues its explainer and persists", () => {
    const { result } = renderProvider();
    act(() => result.current.toggleCard("goals"));

    expect(result.current.visibleCards.has("goals")).toBe(true);
    expect(result.current.pendingExplainCardIds.has("goals")).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toContain("goals");
  });

  it("re-enabling a previously explained card glows instead of explaining", () => {
    localStorage.setItem(EXPLAINED_KEY, JSON.stringify(["goals"]));
    const { result } = renderProvider();

    act(() => result.current.toggleCard("goals"));

    expect(result.current.glowingCards.has("goals")).toBe(true);
    expect(result.current.pendingExplainCardIds.has("goals")).toBe(false);
  });

  it("turning a visible card off removes it", () => {
    const { result } = renderProvider();
    act(() => result.current.toggleCard("budgets"));
    expect(result.current.visibleCards.has("budgets")).toBe(false);
  });

  it("dismissing an explainer records it so it never shows again", () => {
    const { result } = renderProvider();
    act(() => result.current.toggleCard("goals"));
    act(() => result.current.dismissExplainedCard("goals"));

    expect(result.current.pendingExplainCardIds.has("goals")).toBe(false);
    expect(JSON.parse(localStorage.getItem(EXPLAINED_KEY)!)).toContain("goals");
  });

  it("dismisses a card glow", () => {
    localStorage.setItem(EXPLAINED_KEY, JSON.stringify(["goals"]));
    const { result } = renderProvider();
    act(() => result.current.toggleCard("goals"));
    act(() => result.current.dismissCardGlow("goals"));
    expect(result.current.glowingCards.has("goals")).toBe(false);
  });

  it("reorders cards and persists the new order", () => {
    const { result } = renderProvider();
    const [first, second] = ALL_CARD_IDS;

    act(() => result.current.reorderCard(second, first));

    expect(result.current.cardOrder[0]).toBe(second);
    expect(JSON.parse(localStorage.getItem(ORDER_KEY)!)[0]).toBe(second);
  });

  it("resets to the default set and clears stored preferences", () => {
    const { result } = renderProvider();
    act(() => result.current.toggleCard("goals"));
    act(() => result.current.resetToDefaults());

    expect(result.current.visibleCards).toEqual(new Set(DEFAULT_VISIBLE_CARDS));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("persists the collapse-all and orbs preferences", () => {
    const { result } = renderProvider();
    act(() => result.current.setAllCollapsed(true));
    act(() => result.current.setOrbsEnabled(false));

    expect(result.current.allCollapsed).toBe(true);
    expect(result.current.orbsEnabled).toBe(false);
    expect(localStorage.getItem("bloom_dashboard_cards_collapsed")).toBe("true");
    expect(localStorage.getItem("bloom_dashboard_orbs_enabled")).toBe("false");
  });
});
