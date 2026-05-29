import { describe, expect, it } from "vitest";
import {
  evaluateTfsaContribution,
  evaluateRrspContribution,
  evaluateFhsaContribution,
  LOW_ROOM_THRESHOLD,
} from "./over-contribution";

// birthYear=1980, currentYear=2026 → totalRoom=109000 (from TFSA table)
const TFSA_TOTAL_ROOM = 109_000;

describe("evaluateTfsaContribution", () => {
  it("returns 'none' when birthYear is null", () => {
    const result = evaluateTfsaContribution({
      contributionAmount: 5000,
      birthYear: null,
      currentYear: 2026,
      roomUsedElsewhere: null,
      netTfsaContributionsInBloom: 0,
    });
    expect(result.severity).toBe("none");
  });

  it("returns 'none' when contributionAmount is 0", () => {
    const result = evaluateTfsaContribution({
      contributionAmount: 0,
      birthYear: 1980,
      currentYear: 2026,
      roomUsedElsewhere: null,
      netTfsaContributionsInBloom: 100_000,
    });
    expect(result.severity).toBe("none");
  });

  it("returns 'none' when contributionAmount is negative", () => {
    const result = evaluateTfsaContribution({
      contributionAmount: -500,
      birthYear: 1980,
      currentYear: 2026,
      roomUsedElsewhere: null,
      netTfsaContributionsInBloom: 100_000,
    });
    expect(result.severity).toBe("none");
  });

  it("returns 'red' when the contribution would push net contributions over total room", () => {
    // projectedRemaining = 109000 - (108000 + 5000) = -4000
    const result = evaluateTfsaContribution({
      contributionAmount: 5000,
      birthYear: 1980,
      currentYear: 2026,
      roomUsedElsewhere: null,
      netTfsaContributionsInBloom: 108_000,
    });
    expect(result.severity).toBe("red");
  });

  it("returns 'amber' when remaining would be exactly 9% of total room", () => {
    // 9% of 109000 = 9810; projectedRemaining must equal 9810
    // netInBloom = 109000 - 9810 - 1000 = 98190
    const result = evaluateTfsaContribution({
      contributionAmount: 1000,
      birthYear: 1980,
      currentYear: 2026,
      roomUsedElsewhere: null,
      netTfsaContributionsInBloom: 98_190,
    });
    expect(result.severity).toBe("amber");
    // 9810 < 10% of 109000 = 10900 → amber; 9810 >= 0 → not red
  });

  it("returns 'none' when remaining would be more than 10% of total room", () => {
    // projectedRemaining = 109000 - (88000 + 1000) = 20000 (18.3%)
    const result = evaluateTfsaContribution({
      contributionAmount: 1000,
      birthYear: 1980,
      currentYear: 2026,
      roomUsedElsewhere: null,
      netTfsaContributionsInBloom: 88_000,
    });
    expect(result.severity).toBe("none");
  });

  it("subtracts roomUsedElsewhere from total room correctly", () => {
    // Without externalUsed: projectedRemaining = 109000 - (100000 + 1000) = 8000 → amber
    // With externalUsed=10000: projectedRemaining = 109000 - (100000 + 10000 + 1000) = -2000 → red
    const result = evaluateTfsaContribution({
      contributionAmount: 1000,
      birthYear: 1980,
      currentYear: 2026,
      roomUsedElsewhere: 10_000,
      netTfsaContributionsInBloom: 100_000,
    });
    expect(result.severity).toBe("red");
  });

  it("includes the dollar overage amount in the red message", () => {
    // overage = -(109000 - (108000 + 5000)) = 4000
    const result = evaluateTfsaContribution({
      contributionAmount: 5000,
      birthYear: 1980,
      currentYear: 2026,
      roomUsedElsewhere: null,
      netTfsaContributionsInBloom: 108_000,
    });
    expect(result.severity).toBe("red");
    // formatCurrency(4000) in en-CA locale = "$4,000.00"
    expect(result.message).toContain("4,000");
  });

  it("LOW_ROOM_THRESHOLD is exported as 0.1", () => {
    expect(LOW_ROOM_THRESHOLD).toBe(0.1);
  });
});

describe("evaluateRrspContribution", () => {
  it("returns 'none' when rrspContributionRoom is null", () => {
    const result = evaluateRrspContribution({
      contributionAmount: 5000,
      rrspContributionRoom: null,
      netRrspContributionsInBloom: 0,
    });
    expect(result.severity).toBe("none");
  });

  it("returns 'red' when the contribution exceeds the deduction limit", () => {
    // projectedRemaining = 10000 - (9500 + 600) = -100
    const result = evaluateRrspContribution({
      contributionAmount: 600,
      rrspContributionRoom: 10_000,
      netRrspContributionsInBloom: 9_500,
    });
    expect(result.severity).toBe("red");
  });

  it("returns 'amber' when remaining would be below 10% of the deduction limit", () => {
    // projectedRemaining = 10000 - (9100 + 500) = 400; 10% of 10000 = 1000; 400 < 1000 → amber
    const result = evaluateRrspContribution({
      contributionAmount: 500,
      rrspContributionRoom: 10_000,
      netRrspContributionsInBloom: 9_100,
    });
    expect(result.severity).toBe("amber");
  });

  it("returns 'none' when well below the limit", () => {
    // projectedRemaining = 10000 - (0 + 500) = 9500; 10% of 10000 = 1000; 9500 > 1000 → none
    const result = evaluateRrspContribution({
      contributionAmount: 500,
      rrspContributionRoom: 10_000,
      netRrspContributionsInBloom: 0,
    });
    expect(result.severity).toBe("none");
  });

  it("returns 'none' when contributionAmount is 0", () => {
    const result = evaluateRrspContribution({
      contributionAmount: 0,
      rrspContributionRoom: 10_000,
      netRrspContributionsInBloom: 9_900,
    });
    expect(result.severity).toBe("none");
  });
});

describe("evaluateFhsaContribution", () => {
  it("returns 'red' when projected annual contributions would exceed $8,000 even if lifetime is fine", () => {
    // annualRemaining = 8000 - (4000 + 5000) = -1000 → red
    // lifetimeRemaining = 40000 - (4000 + 5000) = 31000 → none
    const result = evaluateFhsaContribution({
      contributionAmount: 5000,
      currentYear: 2026,
      netFhsaContributionsThisYear: 4_000,
      netFhsaContributionsLifetime: 4_000,
    });
    expect(result.severity).toBe("red");
    expect(result.message).toContain("$8,000");
    expect(result.message).toContain("annual");
  });

  it("returns 'red' when projected lifetime would exceed $40,000 even if annual is fine", () => {
    // annualRemaining = 8000 - (0 + 2000) = 6000 → none
    // lifetimeRemaining = 40000 - (39000 + 2000) = -1000 → red
    const result = evaluateFhsaContribution({
      contributionAmount: 2000,
      currentYear: 2026,
      netFhsaContributionsThisYear: 0,
      netFhsaContributionsLifetime: 39_000,
    });
    expect(result.severity).toBe("red");
    expect(result.message).toContain("$40,000");
    expect(result.message).toContain("lifetime");
  });

  it("names the annual limit when it is more restrictive than the lifetime limit", () => {
    // annualRemaining = 8000 - (4500 + 5000) = -1500 → red (over by 1500)
    // lifetimeRemaining = 40000 - (36000 + 5000) = -1000 → red (over by 1000)
    // annual has smaller remaining (-1500 < -1000) → annual wins
    const result = evaluateFhsaContribution({
      contributionAmount: 5000,
      currentYear: 2026,
      netFhsaContributionsThisYear: 4_500,
      netFhsaContributionsLifetime: 36_000,
    });
    expect(result.severity).toBe("red");
    expect(result.message).toContain("$8,000");
    expect(result.message).toContain("annual");
  });

  it("returns 'amber' when near the annual limit", () => {
    // annualRemaining = 8000 - (7200 + 500) = 300; 10% of 8000 = 800; 300 < 800 → amber
    // lifetimeRemaining = 40000 - (7200 + 500) = 32300 → none
    const result = evaluateFhsaContribution({
      contributionAmount: 500,
      currentYear: 2026,
      netFhsaContributionsThisYear: 7_200,
      netFhsaContributionsLifetime: 7_200,
    });
    expect(result.severity).toBe("amber");
    expect(result.message).toContain("annual");
  });

  it("returns 'amber' when near the lifetime limit", () => {
    // annualRemaining = 8000 - (0 + 500) = 7500 → none
    // lifetimeRemaining = 40000 - (36000 + 500) = 3500; 10% of 40000 = 4000; 3500 < 4000 → amber
    const result = evaluateFhsaContribution({
      contributionAmount: 500,
      currentYear: 2026,
      netFhsaContributionsThisYear: 0,
      netFhsaContributionsLifetime: 36_000,
    });
    expect(result.severity).toBe("amber");
    expect(result.message).toContain("lifetime");
  });

  it("returns 'none' when well below both limits", () => {
    const result = evaluateFhsaContribution({
      contributionAmount: 500,
      currentYear: 2026,
      netFhsaContributionsThisYear: 0,
      netFhsaContributionsLifetime: 0,
    });
    expect(result.severity).toBe("none");
  });

  it("returns 'none' when contributionAmount is 0", () => {
    const result = evaluateFhsaContribution({
      contributionAmount: 0,
      currentYear: 2026,
      netFhsaContributionsThisYear: 7_999,
      netFhsaContributionsLifetime: 39_999,
    });
    expect(result.severity).toBe("none");
  });
});
