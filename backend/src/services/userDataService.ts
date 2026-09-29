import prisma from "../lib/prisma";

/** Bumped whenever the export payload's shape changes, so an old file can be recognised later. */
export const USER_DATA_EXPORT_VERSION = 3;

type ProfileRow = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  province: string | null;
  tfsaBirthYear: number | null;
  tfsaRoomUsedElsewhere: string | number | null;
  rrspContributionRoom: string | number | null;
  monthlyTakeHomeIncome: string | number | null;
  payFrequency: string | null;
  nextPayday: Date | null;
  primaryFinancialGoal: string | null;
  billRemindersEnabled: boolean;
  billReminderLeadDays: number;
  budgetOverspendAlertsEnabled: boolean;
  lowBalanceAlertsEnabled: boolean;
  lowBalanceThreshold: string | number | null;
  goalMilestoneAlertsEnabled: boolean;
  goalMilestonePercentages: number[];
  subscriptionPriceAlertsEnabled: boolean;
  createdAt: Date;
};

type AccountRow = {
  id: string;
  ownerName: string;
  nickname: string | null;
  accountType: string;
  balance: string | number;
  frozen: boolean;
  isLinked: boolean;
  institutionName: string | null;
  createdAt: Date;
};

type TransactionRow = {
  id: string;
  type: string;
  amount: string | number;
  effectiveAt: Date;
  description: string | null;
  merchant: string | null;
  category: string | null;
  accountId: string;
  accountName: string;
  accountNickname: string | null;
  accountType: string;
};

type BudgetRow = {
  category: string;
  monthlyLimit: string | number;
  rolloverEnabled: boolean;
  createdAt: Date;
};

type SavingsGoalRow = {
  name: string;
  targetAmount: string | number;
  accountId: string;
  createdAt: Date;
};

type RecurringTransactionRow = {
  name: string;
  type: string;
  amount: string | number;
  category: string | null;
  merchant: string | null;
  description: string | null;
  frequency: string;
  startDate: Date;
  endDate: Date | null;
  active: boolean;
  accountId: string;
};

type ManualEntryRow = {
  name: string;
  type: string;
  amount: string | number;
  date: Date | null;
  createdAt: Date;
};

type CategorizationRuleRow = {
  merchant: string;
  category: string;
  createdAt: Date;
};

type CustomCategoryRow = {
  name: string;
  type: string;
  color: string;
  icon: string | null;
  createdAt: Date;
};

type NetWorthSnapshotRow = {
  month: string;
  netWorth: string | number;
  totalAssets: string | number;
  totalDebt: string | number;
  manualAssets: string | number;
  manualLiabilities: string | number;
};

/** The complete, self-contained snapshot of everything Bloom stores for one user. */
export type UserDataExport = {
  exportVersion: number;
  exportedAt: string;
  profile:
    | (Omit<
        ProfileRow,
        | "tfsaRoomUsedElsewhere"
        | "rrspContributionRoom"
        | "monthlyTakeHomeIncome"
        | "lowBalanceThreshold"
        | "nextPayday"
      > & {
        tfsaRoomUsedElsewhere: number | null;
        rrspContributionRoom: number | null;
        monthlyTakeHomeIncome: number | null;
        lowBalanceThreshold: number | null;
        nextPayday: string | null;
      })
    | null;
  accounts: Array<Omit<AccountRow, "balance"> & { balance: number }>;
  transactions: Array<Omit<TransactionRow, "amount"> & { amount: number }>;
  budgets: Array<Omit<BudgetRow, "monthlyLimit"> & { monthlyLimit: number }>;
  savingsGoals: Array<Omit<SavingsGoalRow, "targetAmount"> & { targetAmount: number }>;
  recurringTransactions: Array<Omit<RecurringTransactionRow, "amount"> & { amount: number }>;
  manualEntries: Array<
    Omit<ManualEntryRow, "amount" | "date"> & {
      amount: number;
      date: string | null;
    }
  >;
  categorizationRules: CategorizationRuleRow[];
  customCategories: CustomCategoryRow[];
  netWorthSnapshots: Array<{
    month: string;
    netWorth: number;
    totalAssets: number;
    totalDebt: number;
    manualAssets: number;
    manualLiabilities: number;
  }>;
};

/** Renders a nullable Postgres Decimal column as a plain number so the JSON file has no wrapper objects. */
function toNullableNumber(value: string | number | null): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Renders a date-only column as YYYY-MM-DD, matching how the rest of the API exposes such dates. */
function toDateOnly(value: Date | null): string | null {
  return value ? (value.toISOString().split("T")[0] as string) : null;
}

/**
 * Collects every live row Bloom holds for the user into one plain-JSON bundle.
 * Soft-deleted rows are left out: the export mirrors what the app currently shows,
 * not its recovery history.
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  const [
    profileRows,
    accountRows,
    transactionRows,
    budgetRows,
    savingsGoalRows,
    recurringRows,
    manualEntryRows,
    categorizationRuleRows,
    customCategoryRows,
    netWorthSnapshotRows,
  ] = await Promise.all([
    prisma.$queryRaw<ProfileRow[]>`
      SELECT "firstName", "lastName", "username", "email", "province", "tfsaBirthYear",
             "tfsaRoomUsedElsewhere", "rrspContributionRoom", "monthlyTakeHomeIncome",
             "payFrequency", "nextPayday", "primaryFinancialGoal", "billRemindersEnabled",
             "billReminderLeadDays", "budgetOverspendAlertsEnabled", "lowBalanceAlertsEnabled",
             "lowBalanceThreshold", "goalMilestoneAlertsEnabled", "goalMilestonePercentages",
             "subscriptionPriceAlertsEnabled", "createdAt"
      FROM "Profile"
      WHERE "userId" = ${userId}
    `,
    prisma.$queryRaw<AccountRow[]>`
      SELECT "id", "ownerName", "nickname", "accountType"::text AS "accountType", "balance",
             "frozen", "isLinked", "institutionName", "createdAt"
      FROM "Account"
      WHERE "userId" = ${userId} AND "deletedAt" IS NULL
      ORDER BY "createdAt" ASC
    `,
    prisma.$queryRaw<TransactionRow[]>`
      SELECT
        t."id",
        t."type"::text        AS "type",
        t."amount",
        t."effectiveAt",
        t."description",
        t."merchant",
        t."category",
        a."id"                AS "accountId",
        a."ownerName"         AS "accountName",
        a."nickname"          AS "accountNickname",
        a."accountType"::text AS "accountType"
      FROM "Transaction" t
      INNER JOIN "Account" a ON (
        (t."type" IN ('WITHDRAWAL', 'TRANSFER_OUT') AND a."id" = t."fromAccountId")
        OR
        (t."type" IN ('DEPOSIT', 'TRANSFER_IN') AND a."id" = t."toAccountId")
      )
      WHERE a."userId" = ${userId} AND t."deletedAt" IS NULL AND a."deletedAt" IS NULL
      ORDER BY t."effectiveAt" DESC, t."createdAt" DESC
    `,
    prisma.$queryRaw<BudgetRow[]>`
      SELECT "category", "monthlyLimit", "rolloverEnabled", "createdAt"
      FROM "CategoryBudget"
      WHERE "userId" = ${userId} AND "deletedAt" IS NULL
      ORDER BY "category" ASC
    `,
    prisma.$queryRaw<SavingsGoalRow[]>`
      SELECT "name", "targetAmount", "accountId", "createdAt"
      FROM "SavingsGoal"
      WHERE "userId" = ${userId} AND "deletedAt" IS NULL
      ORDER BY "createdAt" ASC
    `,
    prisma.$queryRaw<RecurringTransactionRow[]>`
      SELECT "name", "type"::text AS "type", "amount", "category", "merchant", "description",
             "frequency"::text AS "frequency", "startDate", "endDate", "active", "accountId"
      FROM "RecurringTransaction"
      WHERE "userId" = ${userId} AND "deletedAt" IS NULL
      ORDER BY "createdAt" ASC
    `,
    prisma.$queryRaw<ManualEntryRow[]>`
      SELECT "name", "type"::text AS "type", "amount", "date", "createdAt"
      FROM "ManualEntry"
      WHERE "userId" = ${userId} AND "deletedAt" IS NULL
      ORDER BY "createdAt" ASC
    `,
    prisma.$queryRaw<CategorizationRuleRow[]>`
      SELECT "merchant", "category", "createdAt"
      FROM "AutoCategorizationRule"
      WHERE "userId" = ${userId} AND "deletedAt" IS NULL
      ORDER BY "merchant" ASC
    `,
    prisma.$queryRaw<CustomCategoryRow[]>`
      SELECT "name", "type"::text AS "type", "color", "icon", "createdAt"
      FROM "Category"
      WHERE "userId" = ${userId}
      ORDER BY "type" ASC, "name" ASC
    `,
    prisma.$queryRaw<NetWorthSnapshotRow[]>`
      SELECT "month", "netWorth", "totalAssets", "totalDebt", "manualAssets", "manualLiabilities"
      FROM "NetWorthSnapshot"
      WHERE "userId" = ${userId}
      ORDER BY "month" ASC
    `,
  ]);

  const profileRow = profileRows[0];

  return {
    exportVersion: USER_DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profileRow
      ? {
          ...profileRow,
          tfsaRoomUsedElsewhere: toNullableNumber(profileRow.tfsaRoomUsedElsewhere),
          rrspContributionRoom: toNullableNumber(profileRow.rrspContributionRoom),
          monthlyTakeHomeIncome: toNullableNumber(profileRow.monthlyTakeHomeIncome),
          lowBalanceThreshold: toNullableNumber(profileRow.lowBalanceThreshold),
          nextPayday: toDateOnly(profileRow.nextPayday),
        }
      : null,
    accounts: accountRows.map((row) => ({ ...row, balance: Number(row.balance) })),
    transactions: transactionRows.map((row) => ({ ...row, amount: Number(row.amount) })),
    budgets: budgetRows.map((row) => ({ ...row, monthlyLimit: Number(row.monthlyLimit) })),
    savingsGoals: savingsGoalRows.map((row) => ({
      ...row,
      targetAmount: Number(row.targetAmount),
    })),
    recurringTransactions: recurringRows.map((row) => ({ ...row, amount: Number(row.amount) })),
    manualEntries: manualEntryRows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      date: toDateOnly(row.date),
    })),
    categorizationRules: categorizationRuleRows,
    customCategories: customCategoryRows,
    netWorthSnapshots: netWorthSnapshotRows.map((row) => ({
      month: row.month,
      netWorth: Number(row.netWorth),
      totalAssets: Number(row.totalAssets),
      totalDebt: Number(row.totalDebt),
      manualAssets: Number(row.manualAssets),
      manualLiabilities: Number(row.manualLiabilities),
    })),
  };
}

/**
 * Permanently erases the user: every app row (including soft-deleted ones) and the
 * credential login, if they signed up with a password. Runs as one transaction so a
 * failure part-way through cannot leave a half-deleted account behind. Child rows
 * covered by an ON DELETE CASCADE (transaction splits, remember-me tokens) go with
 * their parents. Google sign-ins have no CredentialUser row, so that statement is a
 * no-op for them.
 */
export async function deleteAllUserData(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRaw`
      DELETE FROM "Transaction"
      WHERE "fromAccountId" IN (SELECT "id" FROM "Account" WHERE "userId" = ${userId})
         OR "toAccountId" IN (SELECT "id" FROM "Account" WHERE "userId" = ${userId})
    `,
    prisma.$executeRaw`DELETE FROM "SavingsGoal" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "Notification" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "RecurringTransaction" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "BudgetPeriod" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "CategoryBudget" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "NetWorthSnapshot" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "ManualEntry" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "AutoCategorizationRule" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "Category" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "ActivityLog" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "PlaidItem" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "Account" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "Profile" WHERE "userId" = ${userId}`,
    prisma.$executeRaw`DELETE FROM "CredentialUser" WHERE "id" = ${userId}`,
  ]);
}
