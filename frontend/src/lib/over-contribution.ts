import { calculateTfsaLifetimeRoom, FHSA_ANNUAL_LIMIT, FHSA_LIFETIME_LIMIT } from "./contribution-room";
import { formatCurrency } from "./format";

/** Fraction of total room remaining below which an amber warning is shown. */
export const LOW_ROOM_THRESHOLD = 0.1;

export type OverContributionSeverity = "none" | "amber" | "red";

export type OverContributionWarning = {
  severity: OverContributionSeverity;
  /** Short headline, e.g. "May exceed your TFSA room by $480". Empty string when severity is "none". */
  message: string;
  /** One-sentence detail with the CRA-penalty or limit context. Empty string when severity is "none". */
  detail: string;
};

const NONE: OverContributionWarning = { severity: "none", message: "", detail: "" };

/** Evaluates a hypothetical TFSA deposit against the user's estimated room. Returns severity "none" when birth year is null or the contribution amount is non-positive. */
export function evaluateTfsaContribution(args: {
  contributionAmount: number;
  birthYear: number | null;
  currentYear: number;
  roomUsedElsewhere: number | null;
  netTfsaContributionsInBloom: number;
}): OverContributionWarning {
  const { contributionAmount, birthYear, currentYear, roomUsedElsewhere, netTfsaContributionsInBloom } = args;
  if (birthYear == null || contributionAmount <= 0) return NONE;

  const totalRoom = calculateTfsaLifetimeRoom(birthYear, currentYear);
  if (totalRoom <= 0) return NONE;

  const currentUsed = netTfsaContributionsInBloom + (roomUsedElsewhere ?? 0);
  const projectedRemaining = totalRoom - (currentUsed + contributionAmount);

  if (projectedRemaining < 0) {
    return {
      severity: "red",
      message: `This contribution may put you ${formatCurrency(-projectedRemaining)} over your estimated TFSA room.`,
      detail: "CRA penalizes TFSA over-contributions at 1% per month.",
    };
  }
  if (projectedRemaining < totalRoom * LOW_ROOM_THRESHOLD) {
    return {
      severity: "amber",
      message: `This contribution would leave only ${formatCurrency(projectedRemaining)} of your estimated TFSA room.`,
      detail: "Make sure you've accounted for contributions outside Bloom.",
    };
  }
  return NONE;
}

/** Evaluates a hypothetical RRSP deposit against the user's CRA deduction limit. Returns severity "none" when rrspContributionRoom is null. */
export function evaluateRrspContribution(args: {
  contributionAmount: number;
  rrspContributionRoom: number | null;
  netRrspContributionsInBloom: number;
}): OverContributionWarning {
  const { contributionAmount, rrspContributionRoom, netRrspContributionsInBloom } = args;
  if (rrspContributionRoom == null || contributionAmount <= 0) return NONE;

  const totalRoom = rrspContributionRoom;
  const projectedRemaining = totalRoom - (netRrspContributionsInBloom + contributionAmount);

  if (projectedRemaining < 0) {
    return {
      severity: "red",
      message: `This contribution may put you ${formatCurrency(-projectedRemaining)} over your estimated RRSP deduction limit.`,
      detail: "RRSP over-contributions above $2,000 are penalized at 1% per month.",
    };
  }
  if (projectedRemaining < totalRoom * LOW_ROOM_THRESHOLD) {
    return {
      severity: "amber",
      message: `This contribution would leave only ${formatCurrency(projectedRemaining)} of your estimated RRSP room.`,
      detail: "Make sure your deduction limit from your CRA Notice of Assessment is up to date.",
    };
  }
  return NONE;
}

/** Evaluates a hypothetical FHSA deposit against BOTH the annual and lifetime limits. The returned message identifies which limit is breached. */
export function evaluateFhsaContribution(args: {
  contributionAmount: number;
  currentYear: number;
  netFhsaContributionsThisYear: number;
  netFhsaContributionsLifetime: number;
}): OverContributionWarning {
  const { contributionAmount, currentYear, netFhsaContributionsThisYear, netFhsaContributionsLifetime } = args;
  if (contributionAmount <= 0) return NONE;

  const annualRemaining = FHSA_ANNUAL_LIMIT - (netFhsaContributionsThisYear + contributionAmount);
  const lifetimeRemaining = FHSA_LIFETIME_LIMIT - (netFhsaContributionsLifetime + contributionAmount);

  const severityRank = { none: 0, amber: 1, red: 2 } as const;

  const annualSeverity: OverContributionSeverity =
    annualRemaining < 0 ? "red"
    : annualRemaining < FHSA_ANNUAL_LIMIT * LOW_ROOM_THRESHOLD ? "amber"
    : "none";

  const lifetimeSeverity: OverContributionSeverity =
    lifetimeRemaining < 0 ? "red"
    : lifetimeRemaining < FHSA_LIFETIME_LIMIT * LOW_ROOM_THRESHOLD ? "amber"
    : "none";

  if (annualSeverity === "none" && lifetimeSeverity === "none") return NONE;

  // When severity differs, surface the more critical constraint; when equal, pick the tighter one (smaller remaining)
  let useAnnual: boolean;
  if (severityRank[annualSeverity] > severityRank[lifetimeSeverity]) {
    useAnnual = true;
  } else if (severityRank[lifetimeSeverity] > severityRank[annualSeverity]) {
    useAnnual = false;
  } else {
    useAnnual = annualRemaining <= lifetimeRemaining;
  }

  if (useAnnual) {
    if (annualSeverity === "red") {
      return {
        severity: "red",
        message: `This contribution may exceed your $8,000 FHSA annual limit for ${currentYear}.`,
        detail: "CRA penalizes FHSA over-contributions at 1% per month.",
      };
    }
    return {
      severity: "amber",
      message: `This contribution would leave only ${formatCurrency(annualRemaining)} of your $8,000 FHSA annual limit for ${currentYear}.`,
      detail: "You can carry forward unused FHSA room to the following year.",
    };
  } else {
    if (lifetimeSeverity === "red") {
      return {
        severity: "red",
        message: `This contribution may exceed your $40,000 FHSA lifetime limit.`,
        detail: "CRA penalizes FHSA over-contributions at 1% per month.",
      };
    }
    return {
      severity: "amber",
      message: `This contribution would leave only ${formatCurrency(lifetimeRemaining)} of your $40,000 FHSA lifetime limit.`,
      detail: "The FHSA lifetime contribution limit is $40,000.",
    };
  }
}
