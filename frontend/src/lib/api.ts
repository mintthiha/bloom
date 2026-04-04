const BASE = "/api/bloom";

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

export type AccountType = "CHEQUING" | "SAVINGS";

export type Account = {
  id: string;
  ownerName: string;
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
  description: string | null;
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

export const api = {
  listAccounts: () =>
    request<Account[]>("/accounts"),
  createAccount: (ownerName: string, accountType: AccountType) =>
    request<Account>("/accounts", { method: "POST", body: JSON.stringify({ ownerName, accountType }) }),
  getAccount: (id: string) =>
    request<Account>(`/accounts/${id}`),
  deposit: (id: string, amount: number, description?: string) =>
    request<Account>(`/accounts/${id}/deposit`, { method: "POST", body: JSON.stringify({ amount, description }) }),
  withdraw: (id: string, amount: number, description?: string) =>
    request<Account>(`/accounts/${id}/withdraw`, { method: "POST", body: JSON.stringify({ amount, description }) }),
  transfer: (id: string, toAccountId: string, amount: number, description?: string) =>
    request<{ message: string }>(`/accounts/${id}/transfer`, { method: "POST", body: JSON.stringify({ toAccountId, amount, description }) }),
  getTransactions: (id: string) =>
    request<Transaction[]>(`/accounts/${id}/transactions`),
  freeze: (id: string) =>
    request<Account>(`/accounts/${id}/freeze`, { method: "PATCH" }),
  unfreeze: (id: string) =>
    request<Account>(`/accounts/${id}/unfreeze`, { method: "PATCH" }),
  deleteAccount: (id: string) =>
    request<void>(`/accounts/${id}`, { method: "DELETE" }),
  getProfile: () =>
    request<Profile | null>("/profile"),
  saveProfile: (input: { firstName: string; lastName: string; username: string; email: string }) =>
    request<Profile>("/profile", { method: "PUT", body: JSON.stringify(input) }),
};
