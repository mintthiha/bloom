import type {
  Account,
  AccountType,
  Budget,
  MonthlySummary,
  Profile,
  RecurringTransaction,
  SavingsGoal,
  SubscriptionSummary,
  Transaction,
} from "@/lib/api";
import type { FinancialSnapshot } from "./financial-context";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** Registered account types whose transactions we pull so contribution room can be estimated. */
const REGISTERED_ACCOUNT_TYPES: AccountType[] = ["TFSA", "RRSP"];

/**
 * Server-to-server GET against the backend, authenticated with the internal secret and the
 * acting user's id (same headers the /api/bloom proxy uses). Returns null on any failure so a
 * single missing section degrades gracefully instead of breaking the whole chat request.
 */
async function backendGet<T>(path: string, userId: string): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND}/api${path}`, {
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId,
        "X-Internal-Secret": process.env.INTERNAL_API_SECRET ?? "",
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

/** Fetches transactions for each registered account type, grouped by type, for room math. */
async function fetchRegisteredTransactions(
  accounts: Account[],
  userId: string
): Promise<Partial<Record<AccountType, Transaction[]>>> {
  const byType: Partial<Record<AccountType, Transaction[]>> = {};
  await Promise.all(
    REGISTERED_ACCOUNT_TYPES.map(async (type) => {
      const accountIds = accounts
        .filter((account) => account.accountType === type)
        .map((account) => account.id);
      if (accountIds.length === 0) return;
      const perAccount = await Promise.all(
        accountIds.map((id) => backendGet<Transaction[]>(`/accounts/${id}/transactions`, userId))
      );
      byType[type] = perAccount.flatMap((transactions) => transactions ?? []);
    })
  );
  return byType;
}

/**
 * Pulls the signed-in user's financial data from the backend in parallel and assembles the
 * snapshot the context builder consumes. Every section is best-effort: a failed fetch becomes an
 * empty/null value rather than throwing.
 */
export async function fetchFinancialSnapshot(userId: string): Promise<FinancialSnapshot> {
  const [
    accounts,
    monthlySummary,
    budgets,
    savingsGoals,
    subscriptions,
    recurringTransactions,
    profile,
  ] = await Promise.all([
    backendGet<Account[]>("/accounts", userId),
    backendGet<MonthlySummary>("/accounts/summary/monthly", userId),
    backendGet<Budget[]>("/budgets", userId),
    backendGet<SavingsGoal[]>("/savings-goals", userId),
    backendGet<SubscriptionSummary>("/subscriptions", userId),
    backendGet<RecurringTransaction[]>("/recurring", userId),
    backendGet<Profile>("/profile", userId),
  ]);

  const accountList = accounts ?? [];

  return {
    accounts: accountList,
    monthlySummary: monthlySummary ?? null,
    budgets: budgets ?? [],
    savingsGoals: savingsGoals ?? [],
    subscriptions: subscriptions ?? null,
    recurringTransactions: recurringTransactions ?? [],
    profile: profile ?? null,
    registeredTransactions: await fetchRegisteredTransactions(accountList, userId),
  };
}
