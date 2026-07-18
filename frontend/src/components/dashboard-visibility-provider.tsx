"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CardId =
  | "goals"
  | "financial-health"
  | "insights"
  | "budget-rule"
  | "monthly-snapshot"
  | "budgets"
  | "recurring"
  | "calendar"
  | "net-worth"
  | "account-balances";

export const ALL_CARD_IDS: CardId[] = [
  "goals",
  "financial-health",
  "insights",
  "budget-rule",
  "monthly-snapshot",
  "budgets",
  "recurring",
  "calendar",
  "net-worth",
  "account-balances",
];

/**
 * Cards shown to a brand-new user — a lean starter set that avoids first-run overwhelm.
 * The rest stay off until the user opts in from the Customize panel.
 */
export const DEFAULT_VISIBLE_CARDS: CardId[] = ["monthly-snapshot", "budgets"];

export const CARD_METADATA: Record<
  CardId,
  { label: string; description: string; howItWorks: string; requiresAccounts?: number }
> = {
  goals: {
    label: "Savings Goals",
    description: "Track progress toward your savings targets",
    howItWorks:
      "Set savings targets and watch each goal's progress bar fill as your balances grow.",
  },
  "financial-health": {
    label: "Financial Health Score",
    description: "0–100 score across 5 financial factors",
    howItWorks:
      "A single 0–100 score summarizing five factors like savings rate and debt. Open it to see what's helping or hurting.",
  },
  insights: {
    label: "Your Next Moves",
    description: "Personalized action items based on your data",
    howItWorks:
      "Bloom scans your recent activity and suggests concrete next steps, refreshed as your data changes.",
  },
  "budget-rule": {
    label: "50/30/20 Rule",
    description: "How your spending maps to the 50/30/20 framework",
    howItWorks:
      "See how your spending splits across needs, wants, and savings against the 50/30/20 guideline.",
  },
  "monthly-snapshot": {
    label: "Monthly Snapshot",
    description: "Income, spending, and savings rate for the period",
    howItWorks:
      "Your income, spending, and savings rate for the selected period, with a forecast for the month.",
  },
  budgets: {
    label: "Budgets",
    description: "Category budget progress and remaining amounts",
    howItWorks: "Set a monthly limit per category and track how much you've used and what's left.",
  },
  recurring: {
    label: "Recurring Transactions",
    description: "Scheduled bills and income rules",
    howItWorks:
      "Automate repeating bills and income so they post on schedule without manual entry.",
  },
  calendar: {
    label: "Payment Calendar",
    description: "Upcoming and overdue payment schedule",
    howItWorks: "A month view of upcoming and overdue payments so nothing catches you by surprise.",
  },
  "net-worth": {
    label: "Net Worth History",
    description: "Month-by-month net worth trend",
    howItWorks:
      "Your assets minus debts plotted month over month so you can watch the long-term trend.",
  },
  "account-balances": {
    label: "Account Balances Chart",
    description: "Visual breakdown of balances across accounts",
    howItWorks: "A bar chart comparing balances across every account at a glance.",
    // The chart compares accounts, so it only renders (and can only be enabled) with 2+ accounts.
    requiresAccounts: 2,
  },
};

const STORAGE_KEY = "bloom_dashboard_visible_cards";
const COLLAPSE_STORAGE_KEY = "bloom_dashboard_cards_collapsed";
const ORBS_STORAGE_KEY = "bloom_dashboard_orbs_enabled";
const CARD_ORDER_STORAGE_KEY = "bloom_dashboard_card_order";
const EXPLAINED_STORAGE_KEY = "bloom_dashboard_explained_cards";

type DashboardVisibilityContextValue = {
  visibleCards: Set<CardId>;
  toggleCard: (id: CardId) => void;
  resetToDefaults: () => void;
  allCollapsed: boolean;
  setAllCollapsed: (collapsed: boolean) => void;
  orbsEnabled: boolean;
  setOrbsEnabled: (enabled: boolean) => void;
  cardOrder: CardId[];
  reorderCard: (draggedId: CardId, targetId: CardId) => void;
  /** Cards enabled for the first time, each awaiting its own on-dashboard "how it works" callout. */
  pendingExplainCardIds: Set<CardId>;
  /** Dismisses one card's explainer and remembers it so that card never explains again. */
  dismissExplainedCard: (cardId: CardId) => void;
};

const DashboardVisibilityContext = createContext<DashboardVisibilityContextValue>({
  visibleCards: new Set(ALL_CARD_IDS),
  toggleCard: () => {},
  resetToDefaults: () => {},
  allCollapsed: false,
  setAllCollapsed: () => {},
  orbsEnabled: true,
  setOrbsEnabled: () => {},
  cardOrder: [...ALL_CARD_IDS],
  reorderCard: () => {},
  pendingExplainCardIds: new Set(),
  dismissExplainedCard: () => {},
});

/**
 * Reads the persisted visible-card set from localStorage. New users (no stored preference) get the
 * lean starter set rather than every card at once. Called after mount to keep SSR hydration-safe.
 */
function readStoredVisibility(): Set<CardId> {
  if (typeof window === "undefined") return new Set(DEFAULT_VISIBLE_CARDS);
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set(DEFAULT_VISIBLE_CARDS);
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return new Set(parsed as CardId[]);
  } catch {}
  return new Set(DEFAULT_VISIBLE_CARDS);
}

/** Reads the set of cards whose first-time "how it works" callout has already been dismissed. */
function readStoredExplained(): Set<CardId> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = window.localStorage.getItem(EXPLAINED_STORAGE_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return new Set(parsed as CardId[]);
  } catch {}
  return new Set();
}

/** Reads the persisted "collapse all cards" preference. Called after mount to keep SSR hydration-safe. */
function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
}

/** Reads the persisted "ambient orbs" preference; enabled unless explicitly turned off. */
function readStoredOrbsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ORBS_STORAGE_KEY) !== "false";
}

/**
 * Reads the persisted card display order synchronously, always returning a complete list:
 * stored ids first (in their saved order), then any cards missing from storage appended in
 * their default position so newly added cards still appear.
 */
function readStoredCardOrder(): CardId[] {
  if (typeof window === "undefined") return [...ALL_CARD_IDS];
  try {
    const stored = window.localStorage.getItem(CARD_ORDER_STORAGE_KEY);
    if (!stored) return [...ALL_CARD_IDS];
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((id): id is CardId => ALL_CARD_IDS.includes(id));
      const missing = ALL_CARD_IDS.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
  } catch {}
  return [...ALL_CARD_IDS];
}

export function DashboardVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [visibleCards, setVisibleCards] = useState<Set<CardId>>(
    () => new Set(DEFAULT_VISIBLE_CARDS)
  );
  const [allCollapsed, setAllCollapsedState] = useState<boolean>(false);
  const [orbsEnabled, setOrbsEnabledState] = useState<boolean>(true);
  const [cardOrder, setCardOrder] = useState<CardId[]>(() => [...ALL_CARD_IDS]);
  const [explainedCards, setExplainedCards] = useState<Set<CardId>>(() => new Set());
  const [pendingExplainCardIds, setPendingExplainCardIds] = useState<Set<CardId>>(() => new Set());

  // Hydrate persisted preferences after mount. Reading localStorage during the initial render
  // would make the server markup (defaults) and the client markup (stored values) diverge and
  // trigger a hydration mismatch once the user has customized their cards.
  useEffect(() => {
    setVisibleCards(readStoredVisibility());
    setAllCollapsedState(readStoredCollapsed());
    setOrbsEnabledState(readStoredOrbsEnabled());
    setCardOrder(readStoredCardOrder());
    setExplainedCards(readStoredExplained());
  }, []);

  /**
   * Toggles a card on or off and persists the set. When a card is turned on for the very first
   * time, it is queued for its own on-dashboard "how it works" callout, alongside any other cards
   * still awaiting theirs — enabling a second card never dismisses the first card's callout.
   */
  function toggleCard(cardId: CardId) {
    setVisibleCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
        if (!explainedCards.has(cardId)) {
          setPendingExplainCardIds((pending) => {
            const nextPending = new Set(pending);
            nextPending.add(cardId);
            return nextPending;
          });
        }
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  /** Dismisses one card's explainer and records the card so its callout never shows again. */
  function dismissExplainedCard(cardId: CardId) {
    setPendingExplainCardIds((pending) => {
      if (!pending.has(cardId)) return pending;
      const nextPending = new Set(pending);
      nextPending.delete(cardId);
      return nextPending;
    });
    setExplainedCards((prev) => {
      const next = new Set(prev);
      next.add(cardId);
      window.localStorage.setItem(EXPLAINED_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  /** Restores the lean starter set in default order and clears stored visibility/layout preferences. */
  function resetToDefaults() {
    setVisibleCards(new Set(DEFAULT_VISIBLE_CARDS));
    window.localStorage.removeItem(STORAGE_KEY);
    setCardOrder([...ALL_CARD_IDS]);
    window.localStorage.removeItem(CARD_ORDER_STORAGE_KEY);
  }

  /** Moves the dragged card to just before the target card and persists the new order. */
  function reorderCard(draggedId: CardId, targetId: CardId) {
    setCardOrder((previousOrder) => {
      const fromIndex = previousOrder.indexOf(draggedId);
      const toIndex = previousOrder.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return previousOrder;
      const nextOrder = [...previousOrder];
      nextOrder.splice(fromIndex, 1);
      nextOrder.splice(toIndex, 0, draggedId);
      window.localStorage.setItem(CARD_ORDER_STORAGE_KEY, JSON.stringify(nextOrder));
      return nextOrder;
    });
  }

  /** Collapses or expands every card at once and persists the preference. */
  function setAllCollapsed(collapsed: boolean) {
    setAllCollapsedState(collapsed);
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
  }

  /** Enables or disables the ambient background orbs and persists the preference. */
  function setOrbsEnabled(enabled: boolean) {
    setOrbsEnabledState(enabled);
    window.localStorage.setItem(ORBS_STORAGE_KEY, String(enabled));
  }

  const value = useMemo(
    () => ({
      visibleCards,
      toggleCard,
      resetToDefaults,
      allCollapsed,
      setAllCollapsed,
      orbsEnabled,
      setOrbsEnabled,
      cardOrder,
      reorderCard,
      pendingExplainCardIds,
      dismissExplainedCard,
    }),
    [visibleCards, allCollapsed, orbsEnabled, cardOrder, pendingExplainCardIds]
  );

  return (
    <DashboardVisibilityContext.Provider value={value}>
      {children}
    </DashboardVisibilityContext.Provider>
  );
}

export function useDashboardVisibility() {
  return useContext(DashboardVisibilityContext);
}
