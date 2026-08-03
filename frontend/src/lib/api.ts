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
  isLinked: boolean;
  plaidAccountId: string | null;
  plaidItemId: string | null;
  institutionName: string | null;
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
  merchant: string | null;
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
  tfsaBirthYear: number | null;
  tfsaRoomUsedElsewhere: number | null;
  rrspContributionRoom: number | null;
  billRemindersEnabled: boolean;
  billReminderLeadDays: number;
  createdAt: string;
  updatedAt: string;
};

export type NotificationKind =
  | "BILL_REMINDER"
  | "LOW_BALANCE"
  | "BUDGET_OVERSPEND"
  | "GOAL_REACHED"
  | "SUBSCRIPTION_PRICE";
export type NotificationStatus = "UNREAD" | "READ" | "DISMISSED";

/** A single in-app notification (bill reminders and account alerts). */
export type AppNotification = {
  id: string;
  kind: NotificationKind;
  recurringTransactionId: string | null;
  title: string;
  body: string;
  dueDate: string | null;
  linkHref: string | null;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
};

/** Notification list envelope returned by the notifications endpoint. */
export type NotificationListResult = {
  notifications: AppNotification[];
  unreadCount: number;
};

export type NetWorthSnapshot = {
  id: string;
  month: string;
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
};

export type MonthlyTrend = {
  month: string;
  income: number;
  spending: number;
  net: number;
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

export type CategoryBreakdownItem = {
  category: string;
  accountId: string;
  accountOwnerName: string;
  accountNickname: string | null;
  spending: number;
};

export type Budget = {
  id: string;
  userId: string;
  category: string;
  monthlyLimit: number;
  rolloverEnabled: boolean;
  month: string;
  limit: number;
  carryIn: number;
  adjustment: number;
  available: number;
  currentSpending: number;
  remaining: number;
  carryOut: number;
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

export type TransactionSearchResult = {
  id: string;
  type: string;
  amount: number;
  effectiveAt: string;
  description: string | null;
  merchant: string | null;
  category: string | null;
  accountId: string;
  accountName: string;
  accountNickname: string | null;
  accountType: AccountType;
};

export type SavingsGoal = {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  accountName: string;
  accountNickname: string | null;
  accountOwnerName: string;
  accountType: AccountType;
  percentageReached: number;
  createdAt: string;
  updatedAt: string;
};

export type RecurringTransaction = {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  type: RecurringTransactionType;
  amount: number;
  category: string | null;
  merchant: string | null;
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

export type SubscriptionCadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";

/** Where a surfaced subscription came from: detected history, a known rule, or both agreeing. */
export type SubscriptionSource = "detected" | "rule" | "both";

export type SubscriptionPriceChange = {
  from: number;
  to: number;
  pct: number;
};

export type Subscription = {
  merchant: string;
  cadence: SubscriptionCadence;
  currentPrice: number;
  monthlyCost: number;
  occurrences: number;
  lastChargedAt: string | null;
  nextExpectedAt: string | null;
  source: SubscriptionSource;
  priceChange: SubscriptionPriceChange | null;
};

export type SubscriptionSummary = {
  monthlyTotal: number;
  annualTotal: number;
  count: number;
  subscriptions: Subscription[];
};

export type AutoCategorizationRule = {
  id: string;
  userId: string;
  merchant: string;
  category: string;
  createdAt: string;
  updatedAt: string;
};

export type TransactionQuery = DateRangeQuery & {
  type?: Transaction["type"];
  category?: string;
  search?: string;
};

/** A single row from the cross-account transactions list (shares the search-result shape). */
export type TransactionListItem = TransactionSearchResult;

/** Sort orders accepted by the cross-account transactions list endpoint. */
export type TransactionSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export type TransactionListQuery = DateRangeQuery & {
  account?: string;
  type?: Transaction["type"];
  category?: string;
  search?: string;
  sort?: TransactionSortKey;
  page?: number;
  limit?: number;
};

/** Paginated envelope returned by the cross-account transactions list endpoint. */
export type TransactionListResult = {
  rows: TransactionListItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export const api = {
  listAccounts: () => request<Account[]>("/accounts"),
  getMonthlySummary: (query?: DateRangeQuery) =>
    request<MonthlySummary>(withQuery("/accounts/summary/monthly", query)),
  getMonthlyTrends: (months = 6) =>
    request<MonthlyTrend[]>(`/accounts/summary/trends?months=${months}`),
  recordNetWorthSnapshot: () =>
    request<NetWorthSnapshot>("/accounts/networth/snapshot", { method: "POST" }),
  getNetWorthHistory: (months = 12) =>
    request<NetWorthSnapshot[]>(`/accounts/networth/history?months=${months}`),
  getCategoryBreakdown: (query?: DateRangeQuery) =>
    request<CategoryBreakdownItem[]>(withQuery("/accounts/summary/category-breakdown", query)),
  getBudgets: (query?: DateRangeQuery) => request<Budget[]>(withQuery("/budgets", query)),
  getBudgetActivity: (id: string, query?: DateRangeQuery) =>
    request<BudgetActivity>(withQuery(`/budgets/${id}/activity`, query)),
  listRecurringTransactions: () => request<RecurringTransaction[]>("/recurring"),
  createRecurringTransaction: (input: {
    accountId: string;
    name: string;
    type: RecurringTransactionType;
    amount: number;
    category?: string;
    merchant?: string;
    description?: string;
    frequency: RecurringFrequency;
    startDate: string;
    endDate?: string;
  }) =>
    request<RecurringTransaction>("/recurring", { method: "POST", body: JSON.stringify(input) }),
  updateRecurringTransaction: (
    id: string,
    input: {
      accountId: string;
      name: string;
      type: RecurringTransactionType;
      amount: number;
      category?: string;
      merchant?: string;
      description?: string;
      frequency: RecurringFrequency;
      startDate: string;
      endDate?: string;
    }
  ) =>
    request<RecurringTransaction>(`/recurring/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  applyDueRecurringTransactions: () =>
    request<ApplyRecurringResult>("/recurring/apply-due", { method: "POST" }),
  setRecurringTransactionActive: (id: string, active: boolean) =>
    request<RecurringTransaction>(`/recurring/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),
  deleteRecurringTransaction: (id: string) =>
    request<void>(`/recurring/${id}`, { method: "DELETE" }),
  saveBudget: (category: string, monthlyLimit: number) =>
    request<Budget>("/budgets", {
      method: "PUT",
      body: JSON.stringify({ category, monthlyLimit }),
    }),
  setBudgetRollover: (id: string, enabled: boolean) =>
    request<Budget>(`/budgets/${id}/rollover`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  moveBudgetMoney: (input: {
    fromBudgetId: string;
    toBudgetId: string;
    amount: number;
    month?: string;
  }) =>
    request<{ fromBudgetId: string; toBudgetId: string; month: string; amount: number }>(
      "/budgets/move",
      { method: "POST", body: JSON.stringify(input) }
    ),
  deleteBudget: (id: string) => request<void>(`/budgets/${id}`, { method: "DELETE" }),
  getSubscriptions: () => request<SubscriptionSummary>("/subscriptions"),
  listSavingsGoals: () => request<SavingsGoal[]>("/savings-goals"),
  createSavingsGoal: (input: { accountId: string; name: string; targetAmount: number }) =>
    request<SavingsGoal>("/savings-goals", { method: "POST", body: JSON.stringify(input) }),
  updateSavingsGoal: (
    id: string,
    input: { accountId: string; name: string; targetAmount: number }
  ) => request<SavingsGoal>(`/savings-goals/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteSavingsGoal: (id: string) => request<void>(`/savings-goals/${id}`, { method: "DELETE" }),
  createAccount: (ownerName: string, accountType: AccountType, nickname?: string) =>
    request<Account>("/accounts", {
      method: "POST",
      body: JSON.stringify({ ownerName, accountType, nickname }),
    }),
  getAccount: (id: string) => request<Account>(`/accounts/${id}`),
  deposit: (
    id: string,
    amount: number,
    input?: { category?: string; merchant?: string; description?: string }
  ) =>
    request<Account>(`/accounts/${id}/deposit`, {
      method: "POST",
      body: JSON.stringify({ amount, ...input }),
    }),
  withdraw: (
    id: string,
    amount: number,
    input?: { category?: string; merchant?: string; description?: string }
  ) =>
    request<Account>(`/accounts/${id}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ amount, ...input }),
    }),
  transfer: (id: string, toAccountId: string, amount: number, description?: string) =>
    request<Account>(`/accounts/${id}/transfer`, {
      method: "POST",
      body: JSON.stringify({ toAccountId, amount, description }),
    }),
  getTransactions: (id: string, query?: TransactionQuery) =>
    request<Transaction[]>(withQuery(`/accounts/${id}/transactions`, query)),
  listTransactions: (query?: TransactionListQuery) =>
    request<TransactionListResult>(
      withQuery("/transactions", {
        account: query?.account,
        type: query?.type,
        category: query?.category,
        search: query?.search,
        start: query?.start,
        end: query?.end,
        sort: query?.sort,
        page: query?.page !== undefined ? String(query.page) : undefined,
        limit: query?.limit !== undefined ? String(query.limit) : undefined,
      })
    ),
  updateTransaction: (
    id: string,
    transactionId: string,
    input: {
      amount: number;
      category?: string;
      merchant?: string;
      description?: string;
      effectiveAt?: string;
    }
  ) =>
    request<Account>(`/accounts/${id}/transactions/${transactionId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteTransaction: (id: string, transactionId: string) =>
    request<void>(`/accounts/${id}/transactions/${transactionId}`, { method: "DELETE" }),
  freeze: (id: string) => request<Account>(`/accounts/${id}/freeze`, { method: "PATCH" }),
  unfreeze: (id: string) => request<Account>(`/accounts/${id}/unfreeze`, { method: "PATCH" }),
  updateNickname: (id: string, nickname?: string) =>
    request<Account>(`/accounts/${id}/nickname`, {
      method: "PATCH",
      body: JSON.stringify({ nickname }),
    }),
  deleteAccount: (id: string) => request<void>(`/accounts/${id}`, { method: "DELETE" }),
  importCsv: (
    id: string,
    rows: Array<{
      type: "DEPOSIT" | "WITHDRAWAL";
      amount: number;
      date: string;
      description?: string;
      merchant?: string;
      category?: string;
    }>
  ) =>
    request<{ imported: number; account: Account }>(`/accounts/${id}/import`, {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  searchTransactions: (q: string, limit = 20) =>
    request<TransactionSearchResult[]>(
      withQuery("/transactions/search", { q, limit: String(limit) })
    ),
  createLinkToken: () => request<{ linkToken: string }>("/plaid/link-token", { method: "POST" }),
  exchangePublicToken: (publicToken: string, institutionName: string) =>
    request<{ itemId: string; accountsLinked: number }>("/plaid/exchange-token", {
      method: "POST",
      body: JSON.stringify({ publicToken, institutionName }),
    }),
  resyncPlaidItem: (itemId: string) =>
    request<{ accountsLinked: number }>(`/plaid/sync/${itemId}`, { method: "POST" }),
  getProfile: () => request<Profile | null>("/profile"),
  saveProfile: (input: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    tfsaBirthYear?: number | null;
    tfsaRoomUsedElsewhere?: number | null;
    rrspContributionRoom?: number | null;
  }) => request<Profile>("/profile", { method: "PUT", body: JSON.stringify(input) }),
  updateReminderPreferences: (input: {
    billRemindersEnabled?: boolean;
    billReminderLeadDays?: number;
  }) =>
    request<Profile>("/profile/reminder-preferences", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  listCategorizationRules: () => request<AutoCategorizationRule[]>("/categorization-rules"),
  upsertCategorizationRule: (merchant: string, category: string) =>
    request<AutoCategorizationRule>("/categorization-rules", {
      method: "PUT",
      body: JSON.stringify({ merchant, category }),
    }),
  updateCategorizationRule: (id: string, merchant: string, category: string) =>
    request<AutoCategorizationRule>(`/categorization-rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ merchant, category }),
    }),
  deleteCategorizationRule: (id: string) =>
    request<void>(`/categorization-rules/${id}`, { method: "DELETE" }),
  suggestCategories: (merchants: string[]) =>
    request<{ suggestions: { merchant: string; category: string }[] }>("/auto-categorize/suggest", {
      method: "POST",
      body: JSON.stringify({ merchants }),
    }),
  listNotifications: () => request<NotificationListResult>("/notifications"),
  markNotificationRead: (id: string) =>
    request<AppNotification>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () =>
    request<{ updated: number }>("/notifications/read-all", { method: "POST" }),
  dismissNotification: (id: string) => request<void>(`/notifications/${id}`, { method: "DELETE" }),
};
