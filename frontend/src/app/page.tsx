"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, Account } from "@/lib/api";

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knownIds, setKnownIds] = useState<string[]>([]);

  const loadAccounts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) { setLoading(false); return; }
    const results = await Promise.allSettled(ids.map((id) => api.getAccount(id)));
    const loaded = results
      .filter((r): r is PromiseFulfilledResult<Account> => r.status === "fulfilled")
      .map((r) => r.value);
    setAccounts(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("bloom_ids") ?? "[]") as string[];
    setKnownIds(stored);
    loadAccounts(stored);
  }, [loadAccounts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const account = await api.createAccount(ownerName.trim());
      const next = [account.id, ...knownIds];
      localStorage.setItem("bloom_ids", JSON.stringify(next));
      setKnownIds(next);
      setAccounts((prev) => [account, ...prev]);
      setOwnerName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  function fmt(n: number) {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-12 fade-up">
        <p className="text-[#6b6b6b] text-xs num tracking-widest uppercase mb-3">Pulse Demo Target</p>
        <h1 className="text-4xl font-extrabold tracking-tight">Accounts</h1>
      </div>

      <div className="border border-[#1e1e1e] rounded-lg p-6 mb-10 fade-up fade-up-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6b6b6b] mb-4">Open Account</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Account holder name"
            className="flex-1 bg-[#161616] border border-[#272727] rounded px-4 py-2.5 text-sm outline-none focus:border-amber-500 transition-colors placeholder:text-[#444]"
          />
          <button
            type="submit"
            disabled={creating || !ownerName.trim()}
            className="px-5 py-2.5 bg-amber-500 text-black text-sm font-bold rounded hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? "Opening…" : "Open"}
          </button>
        </form>
        {error && <p className="mt-3 text-red-400 text-xs num">{error}</p>}
      </div>

      <div className="fade-up fade-up-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6b6b6b]">Your Accounts</h2>
          <span className="num text-xs text-[#444]">{accounts.length} total</span>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16" />)}</div>
        ) : accounts.length === 0 ? (
          <div className="border border-dashed border-[#272727] rounded-lg p-10 text-center">
            <p className="text-[#444] text-sm">No accounts yet — open one above.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {accounts.map((acc, i) => (
              <li key={acc.id} className="fade-up" style={{ animationDelay: `${0.05 * i}s` }}>
                <Link
                  href={`/account/${acc.id}`}
                  className="flex items-center justify-between px-5 py-4 bg-[#161616] border border-[#1e1e1e] rounded-lg hover:border-[#333] hover:bg-[#1a1a1a] transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#272727] flex items-center justify-center text-xs font-bold text-amber-500">
                      {acc.ownerName[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{acc.ownerName}</p>
                      <p className="num text-xs text-[#6b6b6b] mt-0.5">{acc.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {acc.frozen && (
                      <span className="text-xs num text-blue-400 border border-blue-400/30 px-2 py-0.5 rounded">FROZEN</span>
                    )}
                    <span className="num text-sm font-medium text-amber-400">{fmt(acc.balance)}</span>
                    <svg className="w-4 h-4 text-[#444] group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
