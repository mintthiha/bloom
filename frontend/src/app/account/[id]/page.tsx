"use client";
import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { api, Account, Transaction } from "@/lib/api";

type Op = "deposit" | "withdraw" | "transfer";

export default function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [account, setAccount] = useState<Account | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [op, setOp] = useState<Op>("deposit");
  const [amount, setAmount] = useState("");
  const [toId, setToId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [opSuccess, setOpSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [acc, transactions] = await Promise.all([api.getAccount(id), api.getTransactions(id)]);
      setAccount(acc);
      setTxns(transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOpError(null);
    setOpSuccess(null);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setOpError("Enter a valid positive amount"); return; }
    setSubmitting(true);
    try {
      if (op === "deposit")  await api.deposit(id, amt);
      if (op === "withdraw") await api.withdraw(id, amt);
      if (op === "transfer") {
        if (!toId.trim()) { setOpError("Destination account ID required"); setSubmitting(false); return; }
        await api.transfer(id, toId.trim(), amt);
      }
      setOpSuccess(`${op.charAt(0).toUpperCase() + op.slice(1)} successful`);
      setAmount("");
      setToId("");
      await refresh();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  function fmt(n: number) {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
  }

  function txnLabel(t: Transaction) {
    switch (t.type) {
      case "DEPOSIT":      return { label: "Deposit",        color: "text-green-400",  sign: "+" };
      case "WITHDRAWAL":   return { label: "Withdrawal",     color: "text-red-400",    sign: "−" };
      case "TRANSFER_OUT": return { label: "Transfer sent",  color: "text-orange-400", sign: "−" };
      case "TRANSFER_IN":  return { label: "Transfer recv.", color: "text-green-400",  sign: "+" };
    }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
      <div className="skeleton h-6 w-32" />
      <div className="skeleton h-20" />
      <div className="skeleton h-40" />
    </div>
  );

  if (error) return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="text-red-400 num text-sm">{error}</p>
      <Link href="/" className="text-amber-500 text-sm mt-4 inline-block hover:underline">← Back</Link>
    </div>
  );

  if (!account) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/" className="text-[#6b6b6b] text-xs num tracking-widest uppercase hover:text-amber-500 transition-colors fade-up inline-flex items-center gap-1 mb-8">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All Accounts
      </Link>

      <div className="border border-[#1e1e1e] rounded-lg p-6 mb-6 fade-up fade-up-1">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-extrabold">{account.ownerName}</h1>
              {account.frozen && (
                <span className="text-xs num text-blue-400 border border-blue-400/30 px-2 py-0.5 rounded">FROZEN</span>
              )}
            </div>
            <p className="num text-xs text-[#6b6b6b]">{account.id}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#6b6b6b] uppercase tracking-widest mb-1">Balance</p>
            <p className="num text-3xl font-bold text-amber-400">{fmt(account.balance)}</p>
          </div>
        </div>
      </div>

      {!account.frozen && (
        <div className="border border-[#1e1e1e] rounded-lg p-6 mb-6 fade-up fade-up-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6b6b6b] mb-4">Transaction</h2>
          <div className="flex gap-1 mb-5 bg-[#161616] p-1 rounded-md w-fit">
            {(["deposit", "withdraw", "transfer"] as Op[]).map((o) => (
              <button
                key={o}
                onClick={() => { setOp(o); setOpError(null); setOpSuccess(null); }}
                className={`px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
                  op === o ? "bg-amber-500 text-black" : "text-[#6b6b6b] hover:text-white"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {op === "transfer" && (
              <input
                type="text"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                placeholder="Destination account ID"
                className="bg-[#161616] border border-[#272727] rounded px-4 py-2.5 text-sm num outline-none focus:border-amber-500 transition-colors placeholder:text-[#444]"
              />
            )}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b6b6b] num text-sm">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="w-full bg-[#161616] border border-[#272727] rounded pl-8 pr-4 py-2.5 text-sm num outline-none focus:border-amber-500 transition-colors placeholder:text-[#444]"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-amber-500 text-black text-sm font-bold rounded hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed capitalize"
              >
                {submitting ? "…" : op}
              </button>
            </div>
          </form>
          {opError   && <p className="mt-3 text-red-400 text-xs num">{opError}</p>}
          {opSuccess && <p className="mt-3 text-green-400 text-xs num">{opSuccess}</p>}
        </div>
      )}

      {account.frozen && (
        <div className="border border-blue-400/20 bg-blue-400/5 rounded-lg px-5 py-4 mb-6 fade-up fade-up-2">
          <p className="text-blue-400 text-sm">This account is frozen. All transactions are disabled.</p>
        </div>
      )}

      <div className="fade-up fade-up-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6b6b6b]">Transaction History</h2>
          <span className="num text-xs text-[#444]">{txns.length} records</span>
        </div>
        {txns.length === 0 ? (
          <div className="border border-dashed border-[#272727] rounded-lg p-8 text-center">
            <p className="text-[#444] text-sm">No transactions yet.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {txns.map((t) => {
              const { label, color, sign } = txnLabel(t);
              return (
                <li key={t.id} className="flex items-center justify-between px-5 py-3.5 bg-[#161616] border border-[#1e1e1e] rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`w-1.5 h-1.5 rounded-full ${sign === "+" ? "bg-green-400" : "bg-red-400"}`} />
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</p>
                      <p className="num text-xs text-[#444] mt-0.5">
                        {new Date(t.createdAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`num text-sm font-semibold ${color}`}>{sign} {fmt(t.amount)}</p>
                    <p className="num text-xs text-[#444] mt-0.5">bal: {fmt(t.balanceAfter)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
