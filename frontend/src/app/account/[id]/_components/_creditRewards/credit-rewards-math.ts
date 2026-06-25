export type CardProgram = {
  id: string;
  name: string;
  description: string;
  rewardType: "points" | "cashback";
  /** Points per $1 for points programs; effective % per $1 for cashback programs. */
  baseRate: number;
  /** Effective rate per category — same unit as baseRate, overrides base for that category. */
  categoryMultipliers: Partial<Record<string, number>>;
};

export const CARD_PROGRAMS: CardProgram[] = [
  {
    id: "basic",
    name: "Basic Rewards",
    description: "1 point per $1 on all purchases",
    rewardType: "points",
    baseRate: 1,
    categoryMultipliers: {},
  },
  {
    id: "travel",
    name: "Travel Card",
    description: "3x Transport · 2x Groceries & Dining · 1x all",
    rewardType: "points",
    baseRate: 1,
    categoryMultipliers: {
      Transport: 3,
      Dining: 2,
      Groceries: 2,
    },
  },
  {
    id: "grocery",
    name: "Grocery Plus",
    description: "5x Groceries · 3x Dining · 2x Transport · 1x all",
    rewardType: "points",
    baseRate: 1,
    categoryMultipliers: {
      Groceries: 5,
      Dining: 3,
      Transport: 2,
    },
  },
  {
    id: "lifestyle",
    name: "Lifestyle Premium",
    description: "5x Dining & Entertainment · 2x Shopping & Groceries · 1x all",
    rewardType: "points",
    baseRate: 1,
    categoryMultipliers: {
      Dining: 5,
      Entertainment: 5,
      Shopping: 2,
      Groceries: 2,
    },
  },
  {
    id: "flat-cashback",
    name: "Flat 1.5% Cash Back",
    description: "1.5% cash back on all purchases",
    rewardType: "cashback",
    baseRate: 1.5,
    categoryMultipliers: {},
  },
  {
    id: "smart-cashback",
    name: "Smart Cash Back",
    description: "3% Groceries & Dining · 2% Transport · 1% all",
    rewardType: "cashback",
    baseRate: 1,
    categoryMultipliers: {
      Groceries: 3,
      Dining: 3,
      Transport: 2,
    },
  },
  {
    id: "premium-cashback",
    name: "Premium Cash Back",
    description: "5% Dining & Entertainment · 2% Groceries & Shopping · 1% all",
    rewardType: "cashback",
    baseRate: 1,
    categoryMultipliers: {
      Dining: 5,
      Entertainment: 5,
      Groceries: 2,
      Shopping: 2,
    },
  },
];

export type CategoryPoints = {
  category: string;
  spending: number;
  multiplier: number;
  points: number;
};

/**
 * Groups charges by category, applies the program's effective rate, and returns sorted reward totals.
 * For points programs, `points` is whole points earned. For cashback programs, `points` is dollar value (2dp).
 */
export function computePointsByCategory(
  charges: { amount: number; category: string | null }[],
  program: CardProgram
): CategoryPoints[] {
  const spendingByCategory: Record<string, number> = {};
  for (const charge of charges) {
    const category = charge.category ?? "Other";
    spendingByCategory[category] = (spendingByCategory[category] ?? 0) + charge.amount;
  }

  return Object.entries(spendingByCategory)
    .map(([category, spending]) => {
      const effectiveRate = program.categoryMultipliers[category] ?? program.baseRate;
      const points =
        program.rewardType === "cashback"
          ? Math.round(spending * effectiveRate) / 100
          : Math.floor(spending * effectiveRate);
      return { category, spending, multiplier: effectiveRate, points };
    })
    .filter((entry) => entry.spending > 0)
    .sort((a, b) => b.points - a.points);
}

/** Sums points across all categories. */
export function computeTotalPoints(categoryPoints: CategoryPoints[]): number {
  return categoryPoints.reduce((sum, entry) => sum + entry.points, 0);
}
