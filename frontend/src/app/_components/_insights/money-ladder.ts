import type { Account, MonthlySummary, Profile, SavingsGoal } from "@/lib/api";
import { accountDisplayName } from "@/lib/account-view";
import { calculateTfsaLifetimeRoom } from "@/lib/contribution-room";
import { formatCurrency } from "@/lib/format";

/**
 * The "where should my next dollar go?" ladder: a fixed priority order for a beginner's savings.
 * The first step that isn't complete is the one the user should focus on now.
 */
export type MoneyLadderStepId =
  | "starter-buffer"
  | "card-debt"
  | "emergency-fund"
  | "tax-sheltered"
  | "beyond-basics";

export type MoneyLadderStepStatus = "done" | "current" | "upcoming";

export type MoneyLadderStep = {
  id: MoneyLadderStepId;
  /** Short label for the step, e.g. "Starter buffer". */
  label: string;
  status: MoneyLadderStepStatus;
};

/** A link that takes the user straight to where they can act on the current step. */
export type MoneyLadderAction = {
  label: string;
  href: string;
};

/** What the current step asks the user to do, with the numbers that make it concrete. */
export type MoneyLadderFocus = {
  stepId: MoneyLadderStepId;
  /** 1-based position of the current step in the ladder. */
  stepNumber: number;
  headline: string;
  detail: string;
  action: MoneyLadderAction | null;
};

export type MoneyLadder = {
  steps: MoneyLadderStep[];
  focus: MoneyLadderFocus;
};

export type MoneyLadderInput = {
  accounts: Account[];
  monthlySummary: MonthlySummary;
  previousMonthlySummary: MonthlySummary | null;
  profile: Profile | null;
  goals: SavingsGoal[];
  /** Calendar year used for TFSA room; injectable so tests don't depend on the clock. */
  currentYear: number;
};

/** Cash a beginner should hold before attacking debt, so a surprise bill doesn't land on a card. */
export const STARTER_BUFFER_TARGET = 1000;

/** Months of expenses the full emergency fund should cover. */
export const EMERGENCY_FUND_MONTHS = 3;

const STEP_LABELS: Record<MoneyLadderStepId, string> = {
  "starter-buffer": "Starter buffer",
  "card-debt": "Clear card debt",
  "emergency-fund": "Emergency fund",
  "tax-sheltered": "Tax-free savings",
  "beyond-basics": "Beyond the basics",
};

const STEP_ORDER: MoneyLadderStepId[] = [
  "starter-buffer",
  "card-debt",
  "emergency-fund",
  "tax-sheltered",
  "beyond-basics",
];

const REGISTERED_ACCOUNT_TYPES: Account["accountType"][] = ["TFSA", "RRSP", "FHSA"];

/** Whole-dollar amount in the user's display currency, for compact sentences. */
function formatWholeDollars(amount: number): string {
  return formatCurrency(amount, { hideCents: true });
}

/** Cash available on short notice: chequing plus savings balances. */
export function sumLiquidBalance(accounts: Account[]): number {
  return accounts
    .filter((account) => account.accountType === "CHEQUING" || account.accountType === "SAVINGS")
    .reduce((sum, account) => sum + account.balance, 0);
}

/**
 * Monthly spending to size the emergency fund against: last month when it has spending (a full
 * month), otherwise this month so far. Zero means there's no spending data yet.
 */
export function selectReferenceSpending(
  monthlySummary: MonthlySummary,
  previousMonthlySummary: MonthlySummary | null
): number {
  const previousSpending = previousMonthlySummary?.spending ?? 0;
  return previousSpending > 0 ? previousSpending : monthlySummary.spending;
}

/** Focus for step 1: build cash up to the starter buffer. */
function describeStarterBuffer(liquidBalance: number): Omit<MoneyLadderFocus, "stepNumber"> {
  const remaining = STARTER_BUFFER_TARGET - liquidBalance;
  return {
    stepId: "starter-buffer",
    headline: `Build a ${formatWholeDollars(STARTER_BUFFER_TARGET)} starter buffer`,
    detail: `You have ${formatWholeDollars(Math.max(liquidBalance, 0))} in chequing and savings, so ${formatWholeDollars(remaining)} to go. A small cushion keeps a surprise bill off your credit card.`,
    action: null,
  };
}

/** Focus for step 2: pay down card balances, pointing at the largest one. */
function describeCardDebt(cardsWithBalance: Account[]): Omit<MoneyLadderFocus, "stepNumber"> {
  const totalOwed = cardsWithBalance.reduce((sum, account) => sum + account.balance, 0);
  const largestCard = cardsWithBalance.reduce((largest, account) =>
    account.balance > largest.balance ? account : largest
  );
  const largestCardName = accountDisplayName(largestCard);
  const headline =
    cardsWithBalance.length === 1
      ? `Pay off ${formatWholeDollars(totalOwed)} on ${largestCardName}`
      : `Pay off ${formatWholeDollars(totalOwed)} across ${cardsWithBalance.length} cards`;
  return {
    stepId: "card-debt",
    headline,
    detail:
      "Card interest (often around 20%) costs more than any savings account earns, so every extra dollar here is a guaranteed return." +
      (cardsWithBalance.length > 1
        ? ` Start with the highest-interest card, or ${largestCardName} if you're not sure.`
        : ""),
    action: { label: `Open ${largestCardName}`, href: `/account/${largestCard.id}` },
  };
}

/** Focus for step 3: grow cash to cover a few months of spending (or start tracking spending). */
function describeEmergencyFund(
  liquidBalance: number,
  referenceSpending: number
): Omit<MoneyLadderFocus, "stepNumber"> {
  if (referenceSpending <= 0) {
    return {
      stepId: "emergency-fund",
      headline: "Track a month of spending",
      detail:
        "Your emergency fund is sized from what you spend in a month. Import or add your transactions so Bloom can set a target.",
      action: { label: "Go to transactions", href: "/transactions" },
    };
  }
  const target = referenceSpending * EMERGENCY_FUND_MONTHS;
  const monthsCovered = Math.max(liquidBalance, 0) / referenceSpending;
  return {
    stepId: "emergency-fund",
    headline: `Grow your emergency fund to ${formatWholeDollars(target)}`,
    detail: `That's ${EMERGENCY_FUND_MONTHS} months of spending; you're at ${monthsCovered.toFixed(1)}. Keep it in a high-interest savings account so it's ready for a job loss or a big repair.`,
    action: { label: "Track it as a goal", href: "/goals" },
  };
}

/** Focus for step 4: start using registered room, with real numbers from the profile when known. */
function describeTaxSheltered(
  accounts: Account[],
  profile: Profile | null,
  currentYear: number
): Omit<MoneyLadderFocus, "stepNumber"> {
  const tfsaAccount = accounts.find((account) => account.accountType === "TFSA");
  const rrspRoom = profile?.rrspContributionRoom ?? null;
  const rrspSentence =
    rrspRoom !== null && rrspRoom > 0
      ? ` You also have ${formatWholeDollars(rrspRoom)} of RRSP room; contributions there lower this year's taxes.`
      : "";

  if (tfsaAccount) {
    return {
      stepId: "tax-sheltered",
      headline: "Start contributing to your TFSA",
      detail: `Growth inside a TFSA is tax-free, and you can withdraw anytime without losing the room for good.${rrspSentence}`,
      action: { label: "See your TFSA room", href: `/account/${tfsaAccount.id}` },
    };
  }

  // With no TFSA in Bloom, unused room is lifetime room minus what the user reported using elsewhere.
  const birthYear = profile?.tfsaBirthYear ?? null;
  const availableRoom =
    birthYear !== null
      ? calculateTfsaLifetimeRoom(birthYear, currentYear) - (profile?.tfsaRoomUsedElsewhere ?? 0)
      : null;
  const roomSentence =
    availableRoom !== null && availableRoom > 0
      ? ` Based on your birth year, you may have up to ${formatWholeDollars(availableRoom)} of room.`
      : "";
  return {
    stepId: "tax-sheltered",
    headline: "Open a TFSA",
    detail: `Growth inside a TFSA is tax-free, and you can withdraw anytime.${roomSentence}${rrspSentence} Add it to Bloom to track your room.`,
    action: null,
  };
}

/** Focus for step 5: the basics are covered, so point at goals. */
function describeBeyondBasics(goals: SavingsGoal[]): Omit<MoneyLadderFocus, "stepNumber"> {
  if (goals.length > 0) {
    return {
      stepId: "beyond-basics",
      headline: "You've covered the basics",
      detail: `Put extra savings toward your ${goals.length} goal${goals.length !== 1 ? "s" : ""}, and keep topping up your TFSA each January when new room arrives.`,
      action: { label: "View goals", href: "/goals" },
    };
  }
  return {
    stepId: "beyond-basics",
    headline: "You've covered the basics",
    detail:
      "Pick something to save for next, like a trip, a car, or a home, and keep topping up your TFSA each January when new room arrives.",
    action: { label: "Set a goal", href: "/goals" },
  };
}

/**
 * Evaluates every ladder step against the user's data. Each step is marked done on its own merits;
 * the first step that isn't done becomes the current focus. "Beyond the basics" is never done, so
 * there is always a focus.
 */
export function buildMoneyLadder({
  accounts,
  monthlySummary,
  previousMonthlySummary,
  profile,
  goals,
  currentYear,
}: MoneyLadderInput): MoneyLadder {
  const liquidBalance = sumLiquidBalance(accounts);
  const cardsWithBalance = accounts.filter(
    (account) => account.accountType === "CREDIT" && account.balance > 0
  );
  const referenceSpending = selectReferenceSpending(monthlySummary, previousMonthlySummary);
  const hasFundedRegisteredAccount = accounts.some(
    (account) => REGISTERED_ACCOUNT_TYPES.includes(account.accountType) && account.balance > 0
  );

  const isStepComplete: Record<MoneyLadderStepId, boolean> = {
    "starter-buffer": liquidBalance >= STARTER_BUFFER_TARGET,
    "card-debt": cardsWithBalance.length === 0,
    "emergency-fund":
      referenceSpending > 0 && liquidBalance >= referenceSpending * EMERGENCY_FUND_MONTHS,
    "tax-sheltered": hasFundedRegisteredAccount,
    "beyond-basics": false,
  };

  const currentStepId = STEP_ORDER.find((stepId) => !isStepComplete[stepId]) ?? "beyond-basics";

  const steps: MoneyLadderStep[] = STEP_ORDER.map((stepId) => ({
    id: stepId,
    label: STEP_LABELS[stepId],
    status: isStepComplete[stepId] ? "done" : stepId === currentStepId ? "current" : "upcoming",
  }));

  const focusByStep: Record<MoneyLadderStepId, () => Omit<MoneyLadderFocus, "stepNumber">> = {
    "starter-buffer": () => describeStarterBuffer(liquidBalance),
    "card-debt": () => describeCardDebt(cardsWithBalance),
    "emergency-fund": () => describeEmergencyFund(liquidBalance, referenceSpending),
    "tax-sheltered": () => describeTaxSheltered(accounts, profile, currentYear),
    "beyond-basics": () => describeBeyondBasics(goals),
  };

  return {
    steps,
    focus: {
      ...focusByStep[currentStepId](),
      stepNumber: STEP_ORDER.indexOf(currentStepId) + 1,
    },
  };
}
