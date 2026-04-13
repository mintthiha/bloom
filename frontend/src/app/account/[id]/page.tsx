"use client";
import { useState, useEffect, useCallback, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Account, DateRangeQuery, Transaction } from "@/lib/api";
import { DateRangeControls } from "@/components/date-range-controls";
import { useDashboardView } from "@/components/dashboard-view-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildDateRangeQuery, DateRangeState, getBrowserTimeZone, getPresetDateRange } from "@/lib/date-range";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type Op = "deposit" | "withdraw" | "transfer";

const INCOME_CATEGORIES = ["Salary", "Freelance", "Gift", "Investment", "Other Income"];
const EXPENSE_CATEGORIES = ["Groceries", "Rent", "Utilities", "Transport", "Dining", "Shopping", "Healthcare", "Entertainment", "Other"];
const TRANSACTION_FILTER_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, "Transfer"];
const ACCOUNT_TYPE_META = {
  CHEQUING: { label: "Chequing", color: "#f59e0b" },
  SAVINGS: { label: "Savings", color: "#22c55e" },
  TFSA: { label: "TFSA", color: "#38bdf8" },
  RRSP: { label: "RRSP", color: "#a78bfa" },
  FHSA: { label: "FHSA", color: "#fb7185" },
  CREDIT: { label: "Credit", color: "#ef4444" },
} as const;

export default function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { view } = useDashboardView();
  const isDoubleColumn = view === "double";
  const pageWidth = isDoubleColumn ? "1200px" : "720px";
  const summaryColumns = isDoubleColumn ? "minmax(0, 1.15fr) minmax(320px, 0.85fr)" : "1fr";
  const detailColumns = isDoubleColumn ? "minmax(0, 1.1fr) minmax(0, 0.9fr)" : "1fr";
  const analyticsColumns = isDoubleColumn ? "1fr 1fr" : "1fr";
  const historyFilterColumns = isDoubleColumn
    ? "minmax(0, 160px) minmax(0, 180px) minmax(0, 1fr)"
    : "1fr";
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
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
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [freezing, setFreezing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nickname, setNickname] = useState("");
  const [editingNickname, setEditingNickname] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingTransactionAmount, setEditingTransactionAmount] = useState("");
  const [editingTransactionCategory, setEditingTransactionCategory] = useState("");
  const [editingTransactionDateTime, setEditingTransactionDateTime] = useState("");
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [pendingDeleteTransactionId, setPendingDeleteTransactionId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | Transaction["type"]>("ALL");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateRange, setFilterDateRange] = useState<DateRangeState>(() => getPresetDateRange("this-month"));
  const [timeZone, setTimeZone] = useState("UTC");

  const transactionQuery: DateRangeQuery & { type?: Transaction["type"]; category?: string; search?: string } = useMemo(() => {
    const base: DateRangeQuery & { type?: Transaction["type"]; category?: string; search?: string } = {
      ...(buildDateRangeQuery(filterDateRange) ?? {}),
    };

    if (filterType !== "ALL") base.type = filterType;
    if (filterCategory !== "ALL") base.category = filterCategory;
    if (filterSearch.trim()) base.search = filterSearch.trim();

    return base;
  }, [filterCategory, filterDateRange, filterSearch, filterType]);

  useEffect(() => {
    if (filterDateRange.preset !== "custom") {
      setFilterDateRange(getPresetDateRange(filterDateRange.preset));
    }
  }, [filterDateRange.preset]);

  useEffect(() => {
    setTimeZone(getBrowserTimeZone());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [acc, transactions, allAccounts] = await Promise.all([api.getAccount(id), api.getTransactions(id, transactionQuery), api.listAccounts()]);
      setAccount(acc);
      setNickname(acc.nickname ?? "");
      setTxns(transactions);
      setAccounts(allAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [id, transactionQuery]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOpError(null);
    setOpSuccess(null);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setOpError("Enter a valid positive amount"); return; }
    setSubmitting(true);
    let desc: string | undefined;
    let transactionCategory: string | undefined;
    if (op === "transfer") {
      desc = description.trim() || undefined;
    } else {
      transactionCategory = category === "Custom..." ? (customCategory.trim() || undefined) : (category || undefined);
    }
    try {
      if (op === "deposit")  await api.deposit(id, amt, { category: transactionCategory });
      if (op === "withdraw") await api.withdraw(id, amt, { category: transactionCategory });
      if (op === "transfer") {
        if (!toId.trim()) { setOpError("Choose a destination account"); setSubmitting(false); return; }
        await api.transfer(id, toId.trim(), amt, desc);
      }
      setOpSuccess(`${op.charAt(0).toUpperCase() + op.slice(1)} successful`);
      setAmount("");
      setToId("");
      setDescription("");
      setCategory("");
      setCustomCategory("");
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
      router.push(`/?deleted=${encodeURIComponent(account!.nickname ?? account!.ownerName)}`);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleSaveNickname() {
    setSavingNickname(true);
    setOpError(null);
    try {
      const updated = await api.updateNickname(id, nickname.trim() || undefined);
      setAccount(updated);
      setNickname(updated.nickname ?? "");
      setEditingNickname(false);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to save nickname");
    } finally {
      setSavingNickname(false);
    }
  }

  function formatDateTimeLocal(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 16);
  }

  function startEditingTransaction(transaction: Transaction) {
    setOpError(null);
    setOpSuccess(null);
    setEditingTransactionId(transaction.id);
    setEditingTransactionAmount(transaction.amount.toString());
    setEditingTransactionCategory(transaction.category ?? "");
    setEditingTransactionDateTime(formatDateTimeLocal(transaction.effectiveAt));
  }

  function cancelEditingTransaction() {
    setEditingTransactionId(null);
    setEditingTransactionAmount("");
    setEditingTransactionCategory("");
    setEditingTransactionDateTime("");
  }

  async function handleSaveTransaction(transactionId: string) {
    const amountValue = parseFloat(editingTransactionAmount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setOpError("Enter a valid positive amount");
      return;
    }

    setSavingTransaction(true);
    setOpError(null);
    setOpSuccess(null);
    try {
      await api.updateTransaction(id, transactionId, {
        amount: amountValue,
        category: editingTransactionCategory.trim() || undefined,
        effectiveAt: editingTransactionDateTime ? new Date(editingTransactionDateTime).toISOString() : undefined,
      });
      cancelEditingTransaction();
      setOpSuccess("Transaction updated");
      await refresh();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to update transaction");
    } finally {
      setSavingTransaction(false);
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    setDeletingTransactionId(transactionId);
    setOpError(null);
    setOpSuccess(null);
    try {
      await api.deleteTransaction(id, transactionId);
      if (editingTransactionId === transactionId) {
        cancelEditingTransaction();
      }
      setOpSuccess("Transaction deleted");
      await refresh();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to delete transaction");
    } finally {
      setDeletingTransactionId(null);
      setPendingDeleteTransactionId(null);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);

  const isEditableTransaction = (transaction: Transaction) =>
    transaction.type === "DEPOSIT" ||
    transaction.type === "WITHDRAWAL" ||
    ((transaction.type === "TRANSFER_OUT" || transaction.type === "TRANSFER_IN") && Boolean(transaction.transferGroupId));

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
    <div style={{ maxWidth: pageWidth, margin: '0 auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="skeleton" style={{ height: '24px', width: '120px' }} />
      <div className="skeleton" style={{ height: '100px' }} />
      <div className="skeleton" style={{ height: '200px' }} />
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: pageWidth, margin: '0 auto', padding: '48px 24px' }}>
      <p className="num" style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
      <Link href="/" style={{ color: '#f59e0b', fontSize: '14px' }}>← Back to accounts</Link>
    </div>
  );

  if (!account) return null;

  const accentColor = ACCOUNT_TYPE_META[account.accountType].color;
  const displayName = account.nickname ?? account.ownerName;
  const transferTargets = accounts.filter(a => a.id !== id);
  return (
    <div style={{ maxWidth: pageWidth, margin: '0 auto', padding: '48px 24px' }}>
      <AlertDialog
        open={pendingDeleteTransactionId !== null}
        onOpenChange={(open) => {
          if (!open && !deletingTransactionId) {
            setPendingDeleteTransactionId(null);
          }
        }}
      >
        <AlertDialogContent>
          <div style={{ padding: "12px 14px" }}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the transaction and replay the account balance history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                onClick={() => setPendingDeleteTransactionId(null)}
                disabled={Boolean(deletingTransactionId)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={() => pendingDeleteTransactionId && handleDeleteTransaction(pendingDeleteTransactionId)}
                disabled={Boolean(deletingTransactionId)}
              >
                {deletingTransactionId ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

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

      <div style={{ display: 'grid', gridTemplateColumns: summaryColumns, gap: '16px', marginBottom: '16px', alignItems: 'start' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px' }}>{displayName}</h1>
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '3px 8px', borderRadius: '5px',
                background: `${accentColor}20`, color: accentColor,
              }}>
                {ACCOUNT_TYPE_META[account.accountType].label}
              </span>
              {account.frozen && (
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: '5px', background: '#3b82f620', color: '#60a5fa' }}>
                  FROZEN
                </span>
              )}
            </div>
            {account.nickname && (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Account holder: {account.ownerName}
              </p>
            )}
            <p className="num" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{account.id}</p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', marginLeft: 'auto' }}>
            <div>
                <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  {account.accountType === "CREDIT" ? "Outstanding Balance" : "Available Balance"}
                </p>
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
                <div style={{ display: 'flex', gap: '6px', padding: '32px', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
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

      <div className="fade-up fade-up-2" style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Account Nickname
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Use a short custom label to identify this account quickly.
            </p>
          </div>
          {!editingNickname && (
            <button
              onClick={() => setEditingNickname(true)}
              style={{
                padding: '8px 12px', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-primary)',
                borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Edit
            </button>
          )}
        </div>

        {editingNickname ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="Optional nickname"
              style={{ ...inputStyle, flex: '1 1 220px' }}
            />
            <button
              onClick={handleSaveNickname}
              disabled={savingNickname}
              style={{
                padding: '10px 16px', background: '#f59e0b', color: '#000',
                fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '8px',
                cursor: savingNickname ? 'not-allowed' : 'pointer', opacity: savingNickname ? 0.45 : 1,
              }}
            >
              {savingNickname ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setNickname(account.nickname ?? ""); setEditingNickname(false); }}
              disabled={savingNickname}
              style={{
                padding: '10px 16px', border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', borderRadius: '8px',
                cursor: savingNickname ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <p style={{ fontSize: '15px', fontWeight: 600 }}>
            {account.nickname ?? 'No nickname set'}
          </p>
        )}
      </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detailColumns, gap: '16px', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Charts */}
      {txns.length > 0 && (() => {
        const chronological = [...txns].reverse();
        const balanceData = chronological.map(t => ({
          timestamp: t.effectiveAt,
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

            <div style={{ display: 'grid', gridTemplateColumns: analyticsColumns, gap: '24px' }}>
              {/* Balance history */}
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Balance History</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={balanceData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                      }
                      minTickGap={24}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={48} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#9ca3af' }}
                      labelFormatter={(value) =>
                        new Date(value).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })
                      }
                      formatter={(value) => [fmt(Number(value)), "Balance"]}
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
                onClick={() => { setOp(o); setOpError(null); setOpSuccess(null); setCategory(""); setCustomCategory(""); setToId(""); setDescription(""); }}
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
              <select
                value={toId}
                onChange={e => setToId(e.target.value)}
                aria-label="Destination account"
                disabled={transferTargets.length === 0}
                style={{
                  ...inputStyle,
                  cursor: transferTargets.length === 0 ? 'not-allowed' : 'pointer',
                  appearance: 'none',
                  color: transferTargets.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                }}
              >
                <option value="">
                  {transferTargets.length === 0 ? "No other accounts available" : "Choose destination account"}
                </option>
                {transferTargets.map(target => {
                  const label = target.nickname ?? target.ownerName;
                  return (
                    <option key={target.id} value={target.id}>
                      {label} - {ACCOUNT_TYPE_META[target.accountType].label} - {target.id.slice(-6)}
                    </option>
                  );
                })}
              </select>
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
                disabled={submitting || (op === "transfer" && transferTargets.length === 0)}
                style={{
                  padding: '10px 24px', background: '#f59e0b', color: '#000',
                  fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '8px',
                  cursor: submitting || (op === "transfer" && transferTargets.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: submitting || (op === "transfer" && transferTargets.length === 0) ? 0.45 : 1, transition: 'opacity 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {submitting ? "…" : op.charAt(0).toUpperCase() + op.slice(1)}
              </button>
            </div>
            {op !== "transfer" ? (
              <>
                <select
                  value={category}
                  onChange={e => { setCategory(e.target.value); setCustomCategory(""); }}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
                >
                  <option value="">Category (optional)</option>
                  <optgroup label={op === "deposit" ? "Income" : "Expenses"}>
                    {(op === "deposit" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </optgroup>
                  <option value="Custom...">Custom...</option>
                </select>
                {category === "Custom..." && (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category"
                    style={inputStyle}
                    autoFocus
                  />
                )}
              </>
            ) : (
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description (optional)"
                style={inputStyle}
              />
            )}
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
      </div>

      {/* Transaction history */}
      <div className="fade-up fade-up-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', minHeight: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
              Transaction History
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Times shown in {timeZone}.
            </p>
          </div>
          <span className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{txns.length} records</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: historyFilterColumns, gap: '10px', marginBottom: '16px' }}>
          <select
            aria-label="Transaction type filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "ALL" | Transaction["type"])}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
          >
            <option value="ALL">All types</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
            <option value="TRANSFER_OUT">Transfer out</option>
            <option value="TRANSFER_IN">Transfer in</option>
          </select>
          <select
            aria-label="Transaction category filter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
          >
            <option value="ALL">All categories</option>
            {TRANSACTION_FILTER_CATEGORIES.map((categoryOption) => (
              <option key={categoryOption} value={categoryOption}>{categoryOption}</option>
            ))}
          </select>
          <input
            type="text"
            aria-label="Transaction search"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Search description"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <DateRangeControls value={filterDateRange} onChange={setFilterDateRange} />
        </div>

        {txns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No transactions yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {txns.map(t => {
              const { label, color, sign, icon } = txnMeta(t);
              const isEditing = editingTransactionId === t.id;
              const canEdit = isEditableTransaction(t);
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: isEditing ? 'stretch' : 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: '10px', transition: 'background 0.1s',
                  gap: '16px',
                  flexWrap: isEditing ? 'wrap' : 'nowrap',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: isEditing ? 'flex-start' : 'center', gap: '14px', flex: isEditing ? '1 1 100%' : 1, minWidth: 0 }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                      background: `${color}18`, border: `1px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700, color,
                    }}>
                      {icon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {isEditing ? (
                        <div style={{ display: 'grid', gap: '12px', width: '100%' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: isDoubleColumn ? 'minmax(0, 180px) minmax(0, 1fr)' : '1fr', gap: '12px', alignItems: 'start' }}>
                            <label style={{ display: 'grid', gap: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                                Amount
                              </span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={editingTransactionAmount}
                                onChange={(e) => setEditingTransactionAmount(e.target.value)}
                                aria-label="Transaction amount"
                                style={inputStyle}
                              />
                            </label>
                            <label style={{ display: 'grid', gap: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                                Category
                              </span>
                              <select
                                value={editingTransactionCategory}
                                onChange={(e) => setEditingTransactionCategory(e.target.value)}
                                aria-label="Transaction category"
                                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', width: '100%' }}
                              >
                                <option value="">No category</option>
                                {(t.type === "DEPOSIT"
                                  ? INCOME_CATEGORIES
                                  : t.type === "WITHDRAWAL"
                                    ? EXPENSE_CATEGORIES
                                    : ["Transfer"]).map((categoryOption) => (
                                  <option key={categoryOption} value={categoryOption}>
                                    {categoryOption}
                                  </option>
                                ))}
                                {editingTransactionCategory &&
                                  !(t.type === "DEPOSIT"
                                    ? INCOME_CATEGORIES
                                    : t.type === "WITHDRAWAL"
                                      ? EXPENSE_CATEGORIES
                                      : ["Transfer"]).includes(editingTransactionCategory) && (
                                    <option value={editingTransactionCategory}>{editingTransactionCategory}</option>
                                  )}
                              </select>
                            </label>
                          </div>
                          <label style={{ display: 'grid', gap: '6px', maxWidth: isDoubleColumn ? '260px' : '100%' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                              Date and time
                            </span>
                            <input
                              type="datetime-local"
                              value={editingTransactionDateTime}
                              onChange={(e) => setEditingTransactionDateTime(e.target.value)}
                              aria-label="Transaction date and time"
                              style={inputStyle}
                            />
                          </label>
                          <p className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Recorded {new Date(t.createdAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      ) : (
                        <>
                          <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.description || label}
                          </p>
                          <p className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {t.description && <span style={{ color: 'var(--text-secondary)', marginRight: '8px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10px' }}>{label}</span>}
                            {t.category && <span style={{ color: 'var(--text-secondary)', marginRight: '8px', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10px' }}>{t.category}</span>}
                            {new Date(t.effectiveAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: isEditing ? 'left' : 'right', flexShrink: 0, minWidth: isEditing ? '100%' : '160px', marginLeft: isEditing ? '48px' : '0' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleSaveTransaction(t.id)}
                          disabled={savingTransaction}
                          style={{
                            padding: '8px 12px', background: '#f59e0b', color: '#000',
                            border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                            cursor: savingTransaction ? 'not-allowed' : 'pointer', opacity: savingTransaction ? 0.45 : 1,
                          }}
                        >
                          {savingTransaction ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingTransaction}
                          disabled={savingTransaction}
                          style={{
                            padding: '8px 12px', border: '1px solid var(--border)', background: 'transparent',
                            color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                            cursor: savingTransaction ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteTransactionId(t.id)}
                          disabled={savingTransaction || deletingTransactionId === t.id}
                          style={{
                            padding: '6px 10px', border: '1px solid #f8717130', background: 'transparent',
                            color: '#f87171', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                            cursor: savingTransaction || deletingTransactionId === t.id ? 'not-allowed' : 'pointer',
                            opacity: savingTransaction || deletingTransactionId === t.id ? 0.45 : 1,
                          }}
                        >
                          {deletingTransactionId === t.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="num" style={{ fontSize: '14px', fontWeight: 600, color, marginBottom: '3px' }}>
                          {sign} {fmt(t.amount)}
                        </p>
                        <p className="num" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: canEdit ? '10px' : '0' }}>
                          {fmt(t.balanceAfter)}
                        </p>
                      </>
                    )}

                    {canEdit ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => startEditingTransaction(t)}
                            disabled={savingTransaction || deletingTransactionId === t.id}
                            style={{
                              padding: '6px 10px', border: '1px solid var(--border)', background: 'transparent',
                              color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                              cursor: savingTransaction || deletingTransactionId === t.id ? 'not-allowed' : 'pointer',
                              opacity: savingTransaction || deletingTransactionId === t.id ? 0.45 : 1,
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteTransactionId(t.id)}
                            disabled={savingTransaction || deletingTransactionId === t.id}
                            style={{
                              padding: '6px 10px', border: '1px solid #f8717130', background: 'transparent',
                              color: '#f87171', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                              cursor: savingTransaction || deletingTransactionId === t.id ? 'not-allowed' : 'pointer',
                              opacity: savingTransaction || deletingTransactionId === t.id ? 0.45 : 1,
                            }}
                          >
                            {deletingTransactionId === t.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
