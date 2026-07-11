"use client";

import { createContext, useContext, useMemo, useState } from "react";

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

export const CARD_METADATA: Record<CardId, { label: string; description: string }> = {
  goals: {
    label: "Savings Goals",
    description: "Track progress toward your savings targets",
  },
  "financial-health": {
    label: "Financial Health Score",
    description: "0–100 score across 5 financial factors",
  },
  insights: {
    label: "Your Next Moves",
    description: "Personalized action items based on your data",
  },
  "budget-rule": {
    label: "50/30/20 Rule",
    description: "How your spending maps to the 50/30/20 framework",
  },
  "monthly-snapshot": {
    label: "Monthly Snapshot",
    description: "Income, spending, and savings rate for the period",
  },
  budgets: {
    label: "Budgets",
    description: "Category budget progress and remaining amounts",
  },
  recurring: {
    label: "Recurring Transactions",
    description: "Scheduled bills and income rules",
  },
  calendar: {
    label: "Payment Calendar",
    description: "Upcoming and overdue payment schedule",
  },
  "net-worth": {
    label: "Net Worth History",
    description: "Month-by-month net worth trend",
  },
  "account-balances": {
    label: "Account Balances Chart",
    description: "Visual breakdown of balances across accounts",
  },
};

const STORAGE_KEY = "bloom_dashboard_visible_cards";
const COLLAPSE_STORAGE_KEY = "bloom_dashboard_cards_collapsed";

type DashboardVisibilityContextValue = {
  visibleCards: Set<CardId>;
  toggleCard: (id: CardId) => void;
  resetToDefaults: () => void;
  allCollapsed: boolean;
  setAllCollapsed: (collapsed: boolean) => void;
};

const DashboardVisibilityContext = createContext<DashboardVisibilityContextValue>({
  visibleCards: new Set(ALL_CARD_IDS),
  toggleCard: () => {},
  resetToDefaults: () => {},
  allCollapsed: false,
  setAllCollapsed: () => {},
});

/** Reads the persisted visible-card set from localStorage synchronously to avoid a flash on first render. */
function readStoredVisibility(): Set<CardId> {
  if (typeof window === "undefined") return new Set(ALL_CARD_IDS);
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set(ALL_CARD_IDS);
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return new Set(parsed as CardId[]);
  } catch {}
  return new Set(ALL_CARD_IDS);
}

/** Reads the persisted "collapse all cards" preference synchronously to avoid a flash on first render. */
function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
}

export function DashboardVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [visibleCards, setVisibleCards] = useState<Set<CardId>>(readStoredVisibility);
  const [allCollapsed, setAllCollapsedState] = useState<boolean>(readStoredCollapsed);

  /** Toggles a card on or off and writes the updated set to localStorage. */
  function toggleCard(cardId: CardId) {
    setVisibleCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  /** Shows all cards and removes the stored preference. */
  function resetToDefaults() {
    setVisibleCards(new Set(ALL_CARD_IDS));
    window.localStorage.removeItem(STORAGE_KEY);
  }

  /** Collapses or expands every card at once and persists the preference. */
  function setAllCollapsed(collapsed: boolean) {
    setAllCollapsedState(collapsed);
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
  }

  const value = useMemo(
    () => ({ visibleCards, toggleCard, resetToDefaults, allCollapsed, setAllCollapsed }),
    [visibleCards, allCollapsed]
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
