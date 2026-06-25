export type CardProgram = {
  id: string;
  name: string;
  description: string;
  basePtsPerDollar: number;
  categoryMultipliers: Partial<Record<string, number>>;
};

export const CARD_PROGRAMS: CardProgram[] = [
  {
    id: "basic",
    name: "Basic Rewards",
    description: "1 point per $1 on all purchases",
    basePtsPerDollar: 1,
    categoryMultipliers: {},
  },
  {
    id: "travel",
    name: "Travel Card",
    description: "3x Transport · 2x Groceries & Dining · 1x all",
    basePtsPerDollar: 1,
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
    basePtsPerDollar: 1,
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
    basePtsPerDollar: 1,
    categoryMultipliers: {
      Dining: 5,
      Entertainment: 5,
      Shopping: 2,
      Groceries: 2,
    },
  },
];

export type CategoryPoints = {
  category: string;
  spending: number;
  multiplier: number;
  points: number;
};

/** Groups charges by category, applies the program's multiplier, and returns sorted point totals. */
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
      const multiplier = program.categoryMultipliers[category] ?? program.basePtsPerDollar;
      return { category, spending, multiplier, points: Math.floor(spending * multiplier) };
    })
    .filter((entry) => entry.spending > 0)
    .sort((a, b) => b.points - a.points);
}

/** Sums points across all categories. */
export function computeTotalPoints(categoryPoints: CategoryPoints[]): number {
  return categoryPoints.reduce((sum, entry) => sum + entry.points, 0);
}
