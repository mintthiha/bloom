"use client";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Account, Transaction } from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type Op = "deposit" | "withdraw" | "transfer";

export default function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [op, setOp] = useState<Op>("deposit");
  const [amount, setAmount] = useState("");
  const [toId, setToId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [opSuccess, setOpSuccess] = useState<string | null>(null);
  const [freezing, setFreezing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    const desc = description.trim() || undefined;
    try {
      if (op === "deposit")  await api.deposit(id, amt, desc);
      if (op === "withdraw") await api.withdraw(id, amt, desc);
      if (op === "transfer") {
        if (!toId.trim()) { setOpError("Destination account ID required"); setSubmitting(false); return; }
        await api.transfer(id, toId.trim(), amt, desc);
      }
      setOpSuccess(`${op.charAt(0).toUpperCase() + op.slice(1)} successful`);
      setAmount("");
      setToId("");
      setDescription("");
      await refresh();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFreeze() {
    setFreezing(true);
    try {
      if (account!.frozen) await api.unfreeze(id);
      else await api.freeze(id);
      await refresh();
    } finally {
      setFreezing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteAccount(id);
      router.push(`/?deleted=${encodeURIComponent(account!.ownerName)}`);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);

  function txnMeta(t: Transaction): { label: string; color: string; sign: string; icon: string } {
    switch (t.type) {
      case "DEPOSIT":      return { label: "Deposit",       color: "#22c55e",  sign: "+", icon: "↓" };
      case "WITHDRAWAL":   return { label: "Withdrawal",    color: "#f87171",  sign: "−", icon: "↑" };
      case "TRANSFER_OUT": return { label: "Transfer out",  color: "#fb923c",  sign: "−", icon: "→" };
      case "TRANSFER_IN":  return { label: "Transfer in",   color: "#22c55e",  sign: "+", icon: "←" };
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    outline: 'none',
    fontFamily: 'inherit',
  };

  if (loading) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="skeleton" style={{ height: '24px', width: '120px' }} />
      <div className="skeleton" style={{ height: '100px' }} />
      <div className="skeleton" style={{ height: '200px' }} />
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>
      <p className="num" style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
      <Link href="/" style={{ color: '#f59e0b', fontSize: '14px' }}>← Back to accounts</Link>
    </div>
  );

  if (!account) return null;

  const isSavings = account.accountType === "SAVINGS";
  const accentColor = isSavings ? "#22c55e" : "#f59e0b";

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>

      {/* Back */}
      <Link href="/" className="fade-up" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '32px',
        transition: 'color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Accounts
      </Link>

      {/* Account card */}
      <div className="fade-up fade-up-1" style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '28px', marginBottom: '16px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative glow */}
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '160px', height: '160px', borderRadius: '50%',
          background: `${accentColor}10`, filter: 'blur(40px)', pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px' }}>{account.ownerName}</h1>
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '3px 8px', borderRadius: '5px',
                background: `${accentColor}20`, color: accentColor,
              }}>
                {account.accountType}
              </span>
              {account.frozen && (
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: '5px', background: '#3b82f620', color: '#60a5fa' }}>
                  FROZEN
                </span>
              )}
            </div>
            <p className="num" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{account.id}</p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '6px' }}>Available Balance</p>
              <p className="num" style={{ fontSize: '30px', fontWeight: 500, color: accentColor }}>{fmt(account.balance)}</p>
            </div>
            <button
              onClick={handleFreeze}
              disabled={freezing}
              style={{
                padding: '6px 14px', border: `1px solid ${account.frozen ? '#3b82f640' : '#f8717140'}`,
                background: account.frozen ? '#3b82f610' : '#f8717110',
                color: account.frozen ? '#60a5fa' : '#f87171',
                borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                cursor: freezing ? 'not-allowed' : 'pointer',
                opacity: freezing ? 0.5 : 1, transition: 'opacity 0.15s',
              }}
            >
              {freezing ? '…' : account.frozen ? 'Unfreeze' : 'Freeze'}
            </button>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  style={{
                    padding: '6px 12px', border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-secondary)',
                    borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    padding: '6px 12px', border: '1px solid #f8717160',
                    background: '#f87171', color: '#000',
                    borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.5 : 1,
                  }}
                >
                  {deleting ? '…' : 'Confirm'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  padding: '6px 14px', border: '1px solid #f8717130',
                  background: 'transparent', color: '#f87171',
                  borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      {txns.length > 0 && (() => {
        const chronological = [...txns].reverse();
        const balanceData = chronological.map(t => ({
          date: new Date(t.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
          balance: t.balanceAfter,
        }));

        const typeCounts: Record<string, number> = {};
        for (const t of txns) typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
        const typeLabels: Record<string, string> = {
          DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal",
          TRANSFER_OUT: "Transfer Out", TRANSFER_IN: "Transfer In",
        };
        const typeColors: Record<string, string> = {
          DEPOSIT: "#22c55e", WITHDRAWAL: "#f87171",
          TRANSFER_OUT: "#fb923c", TRANSFER_IN: "#60a5fa",
        };
        const donutData = Object.entries(typeCounts).map(([type, value]) => ({
          name: typeLabels[type] ?? type, value, color: typeColors[type] ?? "#888",
        }));

        return (
          <div className="fade-up fade-up-2" style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '24px', marginBottom: '16px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Analytics
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Balance history */}
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Balance History</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={balanceData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={48} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Line type="monotone" dataKey="balance" stroke={accentColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: accentColor }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Transaction type breakdown */}
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Transaction Types</p>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={42} outerRadius={64} dataKey="value" paddingAngle={3}>
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#6b7280' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Operations */}
      {!account.frozen && (
        <div className="fade-up fade-up-2" style={{
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '24px', marginBottom: '16px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            New Transaction
          </p>

          {/* Op selector */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '4px', borderRadius: '10px', marginBottom: '18px', width: 'fit-content' }}>
            {(["deposit", "withdraw", "transfer"] as Op[]).map(o => (
              <button
                key={o}
                onClick={() => { setOp(o); setOpError(null); setOpSuccess(null); }}
                style={{
                  padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em',
                  transition: 'all 0.15s',
                  background: op === o ? '#f59e0b' : 'transparent',
                  color: op === o ? '#000' : 'var(--text-secondary)',
                }}
              >
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {op === "transfer" && (
              <input
                type="text"
                value={toId}
                onChange={e => setToId(e.target.value)}
                placeholder="Destination account ID"
                style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
              />
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span className="num" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '14px', pointerEvents: 'none' }}>$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  style={{ ...inputStyle, paddingLeft: '28px' }}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '10px 24px', background: '#f59e0b', color: '#000',
                  fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '8px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.45 : 1, transition: 'opacity 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {submitting ? "…" : op.charAt(0).toUpperCase() + op.slice(1)}
              </button>
            </div>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)"
              style={inputStyle}
            />
          </form>

          {opError   && <p className="num" style={{ color: '#f87171', fontSize: '12px', marginTop: '10px' }}>{opError}</p>}
          {opSuccess && <p className="num" style={{ color: '#22c55e', fontSize: '12px', marginTop: '10px' }}>{opSuccess}</p>}
        </div>
      )}

      {account.frozen && (
        <div className="fade-up fade-up-2" style={{ border: '1px solid #3b82f630', background: '#3b82f608', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
          <p style={{ color: '#60a5fa', fontSize: '14px' }}>This account is frozen. All transactions have been suspended.</p>
        </div>
      )}

      {/* Transaction history */}
      <div className="fade-up fade-up-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
            Transaction History
          </p>
          <span className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{txns.length} records</span>
        </div>

        {txns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No transactions yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {txns.map(t => {
              const { label, color, sign, icon } = txnMeta(t);
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: '10px', transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                      background: `${color}18`, border: `1px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700, color,
                    }}>
                      {icon}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '3px' }}>
                        {t.description || label}
                      </p>
                      <p className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {t.description && <span style={{ color: 'var(--text-secondary)', marginRight: '8px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10px' }}>{label}</span>}
                        {new Date(t.createdAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="num" style={{ fontSize: '14px', fontWeight: 600, color, marginBottom: '3px' }}>
                      {sign} {fmt(t.amount)}
                    </p>
                    <p className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {fmt(t.balanceAfter)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
