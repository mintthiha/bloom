import { Account, Budget, MonthlySummary, SavingsGoal } from "@/lib/api";

export type OnboardingStepId =
  | "profile-setup"
  | "add-first-account"
  | "add-first-transaction"
  | "setup-budget"
  | "create-savings-goal"
  | "explore-learn";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  isComplete: boolean;
  /** Navigation target — hash for same-page scroll, path for another route, null when no action applies. */
  href: string | null;
};

export type DeriveOnboardingStepsParams = {
  accounts: Account[];
  budgets: Budget[];
  goals: SavingsGoal[];
  monthlySummary: MonthlySummary | null;
  hasExploredLearnPage: boolean;
};

/** Computes each onboarding step's completion state from live dashboard data and localStorage flags. */
export function deriveOnboardingSteps({
  accounts,
  budgets,
  goals,
  monthlySummary,
  hasExploredLearnPage,
}: DeriveOnboardingStepsParams): OnboardingStep[] {
  const hasCreatedFirstAccount = accounts.length > 0;
  const hasAddedFirstTransaction =
    monthlySummary !== null && (monthlySummary.income > 0 || monthlySummary.spending > 0);
  const hasSetupBudget = budgets.length > 0;
  const hasCreatedSavingsGoal = goals.length > 0;

  const firstTransactionHref = hasCreatedFirstAccount
    ? `/account/${accounts[0].id}`
    : "#open-account-section";

  return [
    {
      id: "profile-setup",
      label: "Set up your profile",
      isComplete: true,
      href: null,
    },
    {
      id: "add-first-account",
      label: "Add your first account",
      isComplete: hasCreatedFirstAccount,
      href: "#open-account-section",
    },
    {
      id: "add-first-transaction",
      label: "Add your first transaction",
      isComplete: hasAddedFirstTransaction,
      href: firstTransactionHref,
    },
    {
      id: "setup-budget",
      label: "Set up a budget",
      isComplete: hasSetupBudget,
      href: "#budgets-card-section",
    },
    {
      id: "create-savings-goal",
      label: "Create a savings goal",
      isComplete: hasCreatedSavingsGoal,
      href: "/goals",
    },
    {
      id: "explore-learn",
      label: "Explore the Learn page",
      isComplete: hasExploredLearnPage,
      href: "/learn",
    },
  ];
}
