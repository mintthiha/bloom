const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

export type Account = {
  id: string;
  ownerName: string;
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
  createdAt: string;
  fromAccountId: string | null;
  toAccountId: string | null;
};

export const api = {
  createAccount: (ownerName: string) =>
    request<Account>("/accounts", { method: "POST", body: JSON.stringify({ ownerName }) }),
  getAccount: (id: string) =>
    request<Account>(`/accounts/${id}`),
  deposit: (id: string, amount: number) =>
    request<Account>(`/accounts/${id}/deposit`, { method: "POST", body: JSON.stringify({ amount }) }),
  withdraw: (id: string, amount: number) =>
    request<Account>(`/accounts/${id}/withdraw`, { method: "POST", body: JSON.stringify({ amount }) }),
  transfer: (id: string, toAccountId: string, amount: number) =>
    request<{ message: string }>(`/accounts/${id}/transfer`, { method: "POST", body: JSON.stringify({ toAccountId, amount }) }),
  getTransactions: (id: string) =>
    request<Transaction[]>(`/accounts/${id}/transactions`),
};
