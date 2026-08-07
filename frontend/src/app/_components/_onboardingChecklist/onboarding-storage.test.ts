import { afterEach, describe, expect, it } from "vitest";
import {
  clearOnboardingAllStepsComplete,
  clearOnboardingDismissed,
  getLearnPageExplored,
  getOnboardingAllStepsComplete,
  getOnboardingDismissed,
  setLearnPageExplored,
  setOnboardingAllStepsComplete,
  setOnboardingDismissed,
} from "./onboarding-storage";

afterEach(() => {
  localStorage.clear();
});

describe("onboarding dismissal flag", () => {
  it("defaults to false when unset", () => {
    expect(getOnboardingDismissed()).toBe(false);
  });

  it("is true after being set", () => {
    setOnboardingDismissed();
    expect(getOnboardingDismissed()).toBe(true);
  });

  it("reverts to false after being cleared", () => {
    setOnboardingDismissed();
    clearOnboardingDismissed();
    expect(getOnboardingDismissed()).toBe(false);
  });
});

describe("onboarding all-steps-complete flag", () => {
  it("defaults to false when unset", () => {
    expect(getOnboardingAllStepsComplete()).toBe(false);
  });

  it("is true after being set and false after being cleared", () => {
    setOnboardingAllStepsComplete();
    expect(getOnboardingAllStepsComplete()).toBe(true);
    clearOnboardingAllStepsComplete();
    expect(getOnboardingAllStepsComplete()).toBe(false);
  });
});

describe("learn-page-explored flag", () => {
  it("defaults to false when unset", () => {
    expect(getLearnPageExplored()).toBe(false);
  });

  it("is true after being set", () => {
    setLearnPageExplored();
    expect(getLearnPageExplored()).toBe(true);
  });

  it("only reports true for the exact 'true' string", () => {
    localStorage.setItem("bloom_onboarding_learn_explored", "1");
    expect(getLearnPageExplored()).toBe(false);
  });
});
