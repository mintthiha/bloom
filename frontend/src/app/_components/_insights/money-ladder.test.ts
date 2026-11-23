import { describe, expect, it } from "vitest";
import type { Account, MonthlySummary, Profile, SavingsGoal } from "@/lib/api";
import {
  buildMoneyLadder,
  MoneyLadderInput,
  selectReferenceSpending,
  sumLiquidBalance,
} from "./money-ladder";

/** Builds an Account of the given type and balance. */
function makeAccount(
  id: string,
  accountType: Account["accountType"],
  balance: number,
  nickname: string | null = null
): Account {
  return {
    id,
    ownerName: "Test Owner",
    nickname,
    accountType,
    balance,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    color: null,
    icon: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** Builds a MonthlySummary with the given spending. */
function makeSummary(spending: number): MonthlySummary {
  return {
    month: "2026-11",
    income: 0,
    spending,
    netCashFlow: -spending,
    topExpenseCategory: null,
    categories: [],
  };
}

/** Builds a Profile with only the contribution-room fields the ladder reads. */
function makeProfile(overrides: Partial<Profile>): Profile {
  return {
    tfsaBirthYear: null,
    tfsaRoomUsedElsewhere: null,
    rrspContributionRoom: null,
    ...overrides,
  } as Profile;
}

/** Spending $1,000/month, so the 3-month emergency target is $3,000. */
const MONTHLY_SPENDING = 1000;

/** Builds ladder input with $1,000/month spending, no profile, and no goals by default. */
function makeInput(overrides: Partial<MoneyLadderInput>): MoneyLadderInput {
  return {
    accounts: [],
    monthlySummary: makeSummary(MONTHLY_SPENDING),
    previousMonthlySummary: null,
    profile: null,
    goals: [],
    currentYear: 2026,
    ...overrides,
  };
}

/** Status of every step, in ladder order, for compact assertions. */
function statuses(input: MoneyLadderInput): string[] {
  return buildMoneyLadder(input).steps.map((step) => step.status);
}

describe("sumLiquidBalance", () => {
  it("adds chequing and savings but not registered or credit accounts", () => {
    expect(
      sumLiquidBalance([
        makeAccount("chequing", "CHEQUING", 400),
        makeAccount("savings", "SAVINGS", 600),
        makeAccount("tfsa", "TFSA", 5000),
        makeAccount("visa", "CREDIT", 300),
      ])
    ).toBe(1000);
  });
});

describe("selectReferenceSpending", () => {
  it("prefers last month's spending when it has any", () => {
    expect(selectReferenceSpending(makeSummary(100), makeSummary(2000))).toBe(2000);
  });

  it("falls back to this month when last month had no spending or is missing", () => {
    expect(selectReferenceSpending(makeSummary(800), makeSummary(0))).toBe(800);
    expect(selectReferenceSpending(makeSummary(800), null)).toBe(800);
  });
});

describe("buildMoneyLadder — step 1: starter buffer", () => {
  it("is the focus while cash is below $1,000, with the amount still to go", () => {
    const ladder = buildMoneyLadder(
      makeInput({ accounts: [makeAccount("chequing", "CHEQUING", 400)] })
    );

    expect(ladder.focus).toMatchObject({ stepId: "starter-buffer", stepNumber: 1 });
    expect(ladder.focus.headline).toBe("Build a $1,000 starter buffer");
    expect(ladder.focus.detail).toContain("$400 in chequing and savings, so $600 to go");
  });

  it("is done at exactly $1,000", () => {
    const ladder = buildMoneyLadder(
      makeInput({ accounts: [makeAccount("chequing", "CHEQUING", 1000)] })
    );

    expect(ladder.steps[0].status).toBe("done");
    expect(ladder.focus.stepId).not.toBe("starter-buffer");
  });

  it("reports an overdrawn balance as $0 on hand but counts the full gap", () => {
    const ladder = buildMoneyLadder(
      makeInput({ accounts: [makeAccount("chequing", "CHEQUING", -200)] })
    );

    expect(ladder.focus.detail).toContain("$0 in chequing and savings, so $1,200 to go");
  });
});

describe("buildMoneyLadder — step 2: card debt", () => {
  it("names the card and links to it when one card has a balance", () => {
    const ladder = buildMoneyLadder(
      makeInput({
        accounts: [
          makeAccount("chequing", "CHEQUING", 1500),
          makeAccount("visa", "CREDIT", 1840, "Visa"),
        ],
      })
    );

    expect(ladder.focus).toMatchObject({ stepId: "card-debt", stepNumber: 2 });
    expect(ladder.focus.headline).toBe("Pay off $1,840 on Visa");
    expect(ladder.focus.action).toEqual({ label: "Open Visa", href: "/account/visa" });
  });

  it("totals several cards and points at the largest balance", () => {
    const ladder = buildMoneyLadder(
      makeInput({
        accounts: [
          makeAccount("chequing", "CHEQUING", 1500),
          makeAccount("visa", "CREDIT", 300, "Visa"),
          makeAccount("mastercard", "CREDIT", 900, "Mastercard"),
        ],
      })
    );

    expect(ladder.focus.headline).toBe("Pay off $1,200 across 2 cards");
    expect(ladder.focus.detail).toContain("or Mastercard if you're not sure");
    expect(ladder.focus.action?.href).toBe("/account/mastercard");
  });

  it("is done when every card is at zero", () => {
    const ladder = buildMoneyLadder(
      makeInput({
        accounts: [makeAccount("chequing", "CHEQUING", 1500), makeAccount("visa", "CREDIT", 0)],
      })
    );

    expect(ladder.steps[1].status).toBe("done");
  });
});

describe("buildMoneyLadder — step 3: emergency fund", () => {
  it("targets 3 months of spending and reports months covered", () => {
    const ladder = buildMoneyLadder(
      makeInput({ accounts: [makeAccount("savings", "SAVINGS", 1500)] })
    );

    expect(ladder.focus).toMatchObject({ stepId: "emergency-fund", stepNumber: 3 });
    expect(ladder.focus.headline).toBe("Grow your emergency fund to $3,000");
    expect(ladder.focus.detail).toContain("you're at 1.5");
    expect(ladder.focus.action?.href).toBe("/goals");
  });

  it("is done at exactly 3 months of spending", () => {
    expect(statuses(makeInput({ accounts: [makeAccount("savings", "SAVINGS", 3000)] }))[2]).toBe(
      "done"
    );
  });

  it("sizes the target from last month when last month had spending", () => {
    const ladder = buildMoneyLadder(
      makeInput({
        accounts: [makeAccount("savings", "SAVINGS", 1500)],
        monthlySummary: makeSummary(100),
        previousMonthlySummary: makeSummary(2000),
      })
    );

    expect(ladder.focus.headline).toBe("Grow your emergency fund to $6,000");
  });

  it("asks for spending data instead of a target when there is none", () => {
    const ladder = buildMoneyLadder(
      makeInput({
        accounts: [makeAccount("savings", "SAVINGS", 5000)],
        monthlySummary: makeSummary(0),
      })
    );

    expect(ladder.steps[2].status).toBe("current");
    expect(ladder.focus.headline).toBe("Track a month of spending");
    expect(ladder.focus.action?.href).toBe("/transactions");
  });
});

describe("buildMoneyLadder — step 4: tax-free savings", () => {
  const COVERED_BASICS = makeAccount("savings", "SAVINGS", 5000);

  it("suggests opening a TFSA when there isn't one", () => {
    const ladder = buildMoneyLadder(makeInput({ accounts: [COVERED_BASICS] }));

    expect(ladder.focus).toMatchObject({ stepId: "tax-sheltered", stepNumber: 4 });
    expect(ladder.focus.headline).toBe("Open a TFSA");
    expect(ladder.focus.action).toBeNull();
    expect(ladder.focus.detail).not.toContain("you may have up to");
  });

  it("estimates available TFSA room from birth year minus room used elsewhere", () => {
    // Born 2000 → eligible from 2018: 5500 + 6000×4 + 6500 + 7000×3 = 57,000; minus 7,000 used.
    const ladder = buildMoneyLadder(
      makeInput({
        accounts: [COVERED_BASICS],
        profile: makeProfile({ tfsaBirthYear: 2000, tfsaRoomUsedElsewhere: 7000 }),
      })
    );

    expect(ladder.focus.detail).toContain("you may have up to $50,000 of room");
  });

  it("mentions RRSP room only when the profile has some", () => {
    const withRoom = buildMoneyLadder(
      makeInput({
        accounts: [COVERED_BASICS],
        profile: makeProfile({ rrspContributionRoom: 12000 }),
      })
    );
    const withoutRoom = buildMoneyLadder(
      makeInput({ accounts: [COVERED_BASICS], profile: makeProfile({ rrspContributionRoom: 0 }) })
    );

    expect(withRoom.focus.detail).toContain("$12,000 of RRSP room");
    expect(withoutRoom.focus.detail).not.toContain("RRSP");
  });

  it("links to an existing but empty TFSA to start contributing", () => {
    const ladder = buildMoneyLadder(
      makeInput({ accounts: [COVERED_BASICS, makeAccount("tfsa", "TFSA", 0)] })
    );

    expect(ladder.focus.headline).toBe("Start contributing to your TFSA");
    expect(ladder.focus.action).toEqual({ label: "See your TFSA room", href: "/account/tfsa" });
  });

  it.each(["TFSA", "RRSP", "FHSA"] as const)("is done once a %s has money in it", (type) => {
    expect(
      statuses(makeInput({ accounts: [COVERED_BASICS, makeAccount("registered", type, 100)] }))[3]
    ).toBe("done");
  });
});

describe("buildMoneyLadder — step 4 for a first-home saver", () => {
  const COVERED_BASICS = makeAccount("savings", "SAVINGS", 5000);
  const FIRST_HOME_PROFILE = makeProfile({ primaryFinancialGoal: "FIRST_HOME" });

  it("suggests opening an FHSA instead of a TFSA, with the yearly and lifetime limits", () => {
    const ladder = buildMoneyLadder(
      makeInput({ accounts: [COVERED_BASICS], profile: FIRST_HOME_PROFILE })
    );

    expect(ladder.focus).toMatchObject({ stepId: "tax-sheltered", stepNumber: 4 });
    expect(ladder.focus.headline).toBe("Open an FHSA");
    expect(ladder.focus.detail).toContain("up to $8,000 a year, $40,000 in total");
    expect(ladder.focus.detail).toContain("Room only starts building the year you open one");
    expect(ladder.focus.action).toBeNull();
  });

  it("links to an existing but empty FHSA to start contributing", () => {
    const ladder = buildMoneyLadder(
      makeInput({
        accounts: [COVERED_BASICS, makeAccount("fhsa", "FHSA", 0)],
        profile: FIRST_HOME_PROFILE,
      })
    );

    expect(ladder.focus.headline).toBe("Start contributing to your FHSA");
    expect(ladder.focus.action).toEqual({ label: "See your FHSA room", href: "/account/fhsa" });
  });

  it("is not done by a funded TFSA alone — the FHSA comes first", () => {
    const ladder = buildMoneyLadder(
      makeInput({
        accounts: [COVERED_BASICS, makeAccount("tfsa", "TFSA", 2000)],
        profile: FIRST_HOME_PROFILE,
      })
    );

    expect(ladder.steps[3].status).toBe("current");
    expect(ladder.focus.headline).toBe("Open an FHSA");
  });

  it("is done once the FHSA has money in it, and step 5 keeps the FHSA top-up in view", () => {
    const ladder = buildMoneyLadder(
      makeInput({
        accounts: [COVERED_BASICS, makeAccount("fhsa", "FHSA", 500)],
        profile: FIRST_HOME_PROFILE,
      })
    );

    expect(ladder.steps[3].status).toBe("done");
    expect(ladder.focus.stepId).toBe("beyond-basics");
    expect(ladder.focus.detail).toContain("Set a down-payment goal");
    expect(ladder.focus.detail).toContain("keep topping up your FHSA (up to $8,000 a year)");
  });
});

describe("buildMoneyLadder — step 5: beyond the basics", () => {
  const ALL_BASICS = [makeAccount("savings", "SAVINGS", 5000), makeAccount("tfsa", "TFSA", 2000)];

  it("becomes the focus once steps 1–4 are done, and is never marked done", () => {
    expect(statuses(makeInput({ accounts: ALL_BASICS }))).toEqual([
      "done",
      "done",
      "done",
      "done",
      "current",
    ]);
  });

  it("points at existing goals when the user has some", () => {
    const ladder = buildMoneyLadder(
      makeInput({ accounts: ALL_BASICS, goals: [{ id: "g-1" }, { id: "g-2" }] as SavingsGoal[] })
    );

    expect(ladder.focus.detail).toContain("your 2 goals");
    expect(ladder.focus.action).toEqual({ label: "View goals", href: "/goals" });
  });

  it("suggests setting a goal when there are none", () => {
    const ladder = buildMoneyLadder(makeInput({ accounts: ALL_BASICS }));

    expect(ladder.focus.action).toEqual({ label: "Set a goal", href: "/goals" });
  });
});

describe("buildMoneyLadder — step statuses", () => {
  it("marks later steps done on their own merits while an earlier step is still current", () => {
    // Plenty of cash and a funded TFSA, but a card balance: only step 2 is outstanding.
    expect(
      statuses(
        makeInput({
          accounts: [
            makeAccount("savings", "SAVINGS", 5000),
            makeAccount("tfsa", "TFSA", 2000),
            makeAccount("visa", "CREDIT", 500),
          ],
        })
      )
    ).toEqual(["done", "current", "done", "done", "upcoming"]);
  });

  it("has exactly one current step", () => {
    const ladder = buildMoneyLadder(makeInput({ accounts: [makeAccount("visa", "CREDIT", 500)] }));

    expect(ladder.steps.filter((step) => step.status === "current")).toHaveLength(1);
    expect(ladder.steps.map((step) => step.status)).toEqual([
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });
});
