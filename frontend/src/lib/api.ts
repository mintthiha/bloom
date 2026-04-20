const BASE = "/api/bloom";

export type DateRangeQuery = {
  start?: string;
  end?: string;
};

export type RecurringTransactionType = "DEPOSIT" | "WITHDRAWAL";
export type RecurringFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

function withQuery(path: string, query?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body as T;
}

export type AccountType = "CHEQUING" | "SAVINGS" | "TFSA" | "RRSP" | "FHSA" | "CREDIT";

export type Account = {
  id: string;
  ownerName: string;
  nickname: string | null;
  accountType: AccountType;
  balance: number;
  frozen: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER_OUT" | "TRANSFER_IN";
  amount: number;
  balanceAfter: number;
  transferGroupId?: string | null;
  category: string | null;
  description: string | null;
  effectiveAt: string;
  createdAt: string;
  fromAccountId: string | null;
  toAccountId: string | null;
};

export type Profile = {
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlySummary = {
  month: string;
  income: number;
  spending: number;
  netCashFlow: number;
  topExpenseCategory: string | null;
  categories: Array<{
    category: string;
    income: number;
    spending: number;
  }>;
};

export type Budget = {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
  currentSpending: number;
  remaining: number;
  percentageUsed: number;
  isOverBudget: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BudgetActivity = Budget & {
  month: string;
  activity: Array<{
    id: string;
    amount: number;
    category: string | null;
    description: string | null;
    effectiveAt: string;
    createdAt: string;
    accountId: string;
    accountName: string;
    accountNickname: string | null;
    accountOwnerName: string;
  }>;
  dailySpending: Array<{
    day: string;
    total: number;
  }>;
  accountTotals: Array<{
    accountId: string;
    accountName: string;
    accountNickname: string | null;
    accountOwnerName: string;
    total: number;
  }>;
};

export type RecurringTransaction = {
  id: string;
  userId: string;
  accountId: string;
  type: RecurringTransactionType;
  amount: number;
  category: string | null;
  description: string | null;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string | null;
  nextRunAt: string;
  lastRunAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  accountOwnerName: string;
  accountNickname: string | null;
  accountType: AccountType;
};

export type ApplyRecurringResult = {
  appliedCount: number;
  failedCount: number;
  applied: Array<{
    recurringTransactionId: string;
    occurrenceAt: string;
    type: RecurringTransactionType;
    amount: number;
    accountId: string;
  }>;
  failures: Array<{
    recurringTransactionId: string;
    accountId: string;
    occurrenceAt: string;
    message: string;
  }>;
};

export type TransactionQuery = DateRangeQuery & {
  type?: Transaction["type"];
  category?: string;
  search?: string;
};

export const api = {
  listAccounts: () =>
    request<Account[]>("/accounts"),
  getMonthlySummary: (query?: DateRangeQuery) =>
    request<MonthlySummary>(withQuery("/accounts/summary/monthly", query)),
  getBudgets: (query?: DateRangeQuery) =>
    request<Budget[]>(withQuery("/budgets", query)),
  getBudgetActivity: (id: string, query?: DateRangeQuery) =>
    request<BudgetActivity>(withQuery(`/budgets/${id}/activity`, query)),
  listRecurringTransactions: () =>
    request<RecurringTransaction[]>("/recurring"),
  createRecurringTransaction: (input: {
    accountId: string;
    type: RecurringTransactionType;
    amount: number;
    category?: string;
    description?: string;
    frequency: RecurringFrequency;
    startDate: string;
    endDate?: string;
  }) =>
    request<RecurringTransaction>("/recurring", { method: "POST", body: JSON.stringify(input) }),
  applyDueRecurringTransactions: () =>
    request<ApplyRecurringResult>("/recurring/apply-due", { method: "POST" }),
  setRecurringTransactionActive: (id: string, active: boolean) =>
    request<RecurringTransaction>(`/recurring/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
  deleteRecurringTransaction: (id: string) =>
    request<void>(`/recurring/${id}`, { method: "DELETE" }),
  saveBudget: (category: string, monthlyLimit: number) =>
    request<Budget>("/budgets", { method: "PUT", body: JSON.stringify({ category, monthlyLimit }) }),
  deleteBudget: (id: string) =>
    request<void>(`/budgets/${id}`, { method: "DELETE" }),
  createAccount: (ownerName: string, accountType: AccountType, nickname?: string) =>
    request<Account>("/accounts", { method: "POST", body: JSON.stringify({ ownerName, accountType, nickname }) }),
  getAccount: (id: string) =>
    request<Account>(`/accounts/${id}`),
  deposit: (id: string, amount: number, input?: { category?: string; description?: string }) =>
    request<Account>(`/accounts/${id}/deposit`, { method: "POST", body: JSON.stringify({ amount, ...input }) }),
  withdraw: (id: string, amount: number, input?: { category?: string; description?: string }) =>
    request<Account>(`/accounts/${id}/withdraw`, { method: "POST", body: JSON.stringify({ amount, ...input }) }),
  transfer: (id: string, toAccountId: string, amount: number, description?: string) =>
    request<Account>(`/accounts/${id}/transfer`, { method: "POST", body: JSON.stringify({ toAccountId, amount, description }) }),
  getTransactions: (id: string, query?: TransactionQuery) =>
    request<Transaction[]>(withQuery(`/accounts/${id}/transactions`, query)),
  updateTransaction: (id: string, transactionId: string, input: { amount: number; category?: string; description?: string; effectiveAt?: string }) =>
    request<Account>(`/accounts/${id}/transactions/${transactionId}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteTransaction: (id: string, transactionId: string) =>
    request<void>(`/accounts/${id}/transactions/${transactionId}`, { method: "DELETE" }),
  freeze: (id: string) =>
    request<Account>(`/accounts/${id}/freeze`, { method: "PATCH" }),
  unfreeze: (id: string) =>
    request<Account>(`/accounts/${id}/unfreeze`, { method: "PATCH" }),
  updateNickname: (id: string, nickname?: string) =>
    request<Account>(`/accounts/${id}/nickname`, { method: "PATCH", body: JSON.stringify({ nickname }) }),
  deleteAccount: (id: string) =>
    request<void>(`/accounts/${id}`, { method: "DELETE" }),
  getProfile: () =>
    request<Profile | null>("/profile"),
  saveProfile: (input: { firstName: string; lastName: string; username: string; email: string }) =>
    request<Profile>("/profile", { method: "PUT", body: JSON.stringify(input) }),
};
