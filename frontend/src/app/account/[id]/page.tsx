"use client";
import { useState, useEffect, useCallback, use, useMemo } from "react";
import Link from "next/link";
import { api, Account, DateRangeQuery, Transaction } from "@/lib/api";
import { BackToHome } from "./_components/_accountActions/BackToHome";
import { useDashboardView } from "@/components/dashboard-view-provider";
import { ImportTab } from "./_components/_import/ImportTab";
import { AccountCard } from "./_components/_accountCard/AccountCard";
import { NicknameEditor } from "./_components/_accountActions/NicknameEditor";
import { DeleteTransaction } from "./_components/_accountTransactions/DeleteTransaction";
import { TransactionHistory } from "./_components/_accountTransactions/TransactionHistory";
import {
  buildDateRangeQuery,
  DateRangeState,
  getBrowserTimeZone,
  getPresetDateRange,
} from "@/lib/date-range";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Op = "deposit" | "withdraw" | "transfer" | "import";

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Gift",
  "Investment",
  "Other Income",
];
const EXPENSE_CATEGORIES = [
  "Groceries",
  "Rent",
  "Utilities",
  "Transport",
  "Dining",
  "Shopping",
  "Healthcare",
  "Entertainment",
  "Other",
];
const ACCOUNT_TYPE_META = {
  CHEQUING: { label: "Chequing", color: "#f59e0b" },
  SAVINGS: { label: "Savings", color: "#22c55e" },
  TFSA: { label: "TFSA", color: "#38bdf8" },
  RRSP: { label: "RRSP", color: "#a78bfa" },
  FHSA: { label: "FHSA", color: "#fb7185" },
  CREDIT: { label: "Credit", color: "#ef4444" },
} as const;

export default function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { view } = useDashboardView();
  const isDoubleColumn = view === "double";
  const pageWidth = isDoubleColumn ? "1200px" : "720px";
  const summaryColumns = isDoubleColumn
    ? "minmax(0, 1.15fr) minmax(320px, 0.85fr)"
    : "1fr";
  const detailColumns = isDoubleColumn
    ? "minmax(0, 1.1fr) minmax(0, 0.9fr)"
    : "1fr";
  const analyticsColumns = isDoubleColumn ? "1fr 1fr" : "1fr";
  const historyFilterColumns = isDoubleColumn
    ? "minmax(0, 160px) minmax(0, 180px) minmax(0, 1fr)"
    : "1fr";
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [op, setOp] = useState<Op>("deposit");
  const [amount, setAmount] = useState("");
  const [toId, setToId] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [opSuccess, setOpSuccess] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [editingTransactionAmount, setEditingTransactionAmount] = useState("");
  const [editingTransactionCategory, setEditingTransactionCategory] =
    useState("");
  const [editingTransactionMerchant, setEditingTransactionMerchant] =
    useState("");
  const [editingTransactionDateTime, setEditingTransactionDateTime] =
    useState("");
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [pendingDeleteTransactionId, setPendingDeleteTransactionId] = useState<
    string | null
  >(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<
    string | null
  >(null);
  const [filterType, setFilterType] = useState<"ALL" | Transaction["type"]>(
    "ALL",
  );
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateRange, setFilterDateRange] = useState<DateRangeState>(() =>
    getPresetDateRange("this-month"),
  );
  const [timeZone, setTimeZone] = useState("UTC");

  const transactionQuery: DateRangeQuery & {
    type?: Transaction["type"];
    category?: string;
    search?: string;
  } = useMemo(() => {
    const base: DateRangeQuery & {
      type?: Transaction["type"];
      category?: string;
      search?: string;
    } = {
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
      const [acc, transactions, allAccounts] = await Promise.all([
        api.getAccount(id),
        api.getTransactions(id, transactionQuery),
        api.listAccounts(),
      ]);
      setAccount(acc);
      setTxns(transactions);
      setAccounts(allAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [id, transactionQuery]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Submits a deposit, withdrawal, or transfer based on the selected op. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOpError(null);
    setOpSuccess(null);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setOpError("Enter a valid positive amount");
      return;
    }
    setSubmitting(true);
    let desc: string | undefined;
    let transactionCategory: string | undefined;
    let transactionMerchant: string | undefined;
    if (op === "transfer") {
      desc = description.trim() || undefined;
    } else {
      transactionCategory =
        category === "Custom..."
          ? customCategory.trim() || undefined
          : category || undefined;
      transactionMerchant = merchant.trim() || undefined;
    }
    try {
      if (op === "deposit")
        await api.deposit(id, amt, {
          category: transactionCategory,
          merchant: transactionMerchant,
        });
      if (op === "withdraw")
        await api.withdraw(id, amt, {
          category: transactionCategory,
          merchant: transactionMerchant,
        });
      if (op === "transfer") {
        if (!toId.trim()) {
          setOpError("Choose a destination account");
          setSubmitting(false);
          return;
        }
        await api.transfer(id, toId.trim(), amt, desc);
      }
      const opDisplayName =
        account!.accountType === "CREDIT" && op === "deposit"
          ? "Charge"
          : account!.accountType === "CREDIT" && op === "withdraw"
            ? "Payment"
            : op.charAt(0).toUpperCase() + op.slice(1);
      setOpSuccess(`${opDisplayName} successful`);
      setAmount("");
      setToId("");
      setDescription("");
      setMerchant("");
      setCategory("");
      setCustomCategory("");
      await refresh();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  /** Converts an ISO timestamp to a datetime-local input value in local time. */
  function formatDateTimeLocal(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const localDate = new Date(
      date.getTime() - date.getTimezoneOffset() * 60_000,
    );
    return localDate.toISOString().slice(0, 16);
  }

  /** Populates the inline edit form fields from a transaction's current values. */
  function startEditingTransaction(transaction: Transaction) {
    setOpError(null);
    setOpSuccess(null);
    setEditingTransactionId(transaction.id);
    setEditingTransactionAmount(transaction.amount.toString());
    setEditingTransactionCategory(transaction.category ?? "");
    setEditingTransactionMerchant(transaction.merchant ?? "");
    setEditingTransactionDateTime(formatDateTimeLocal(transaction.effectiveAt));
  }

  /** Clears all inline edit state. */
  function cancelEditingTransaction() {
    setEditingTransactionId(null);
    setEditingTransactionAmount("");
    setEditingTransactionCategory("");
    setEditingTransactionMerchant("");
    setEditingTransactionDateTime("");
  }

  /** Persists edits to a transaction via the API and refreshes the list. */
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
        merchant: editingTransactionMerchant.trim() || undefined,
        effectiveAt: editingTransactionDateTime
          ? new Date(editingTransactionDateTime).toISOString()
          : undefined,
      });
      cancelEditingTransaction();
      setOpSuccess("Transaction updated");
      await refresh();
    } catch (err) {
      setOpError(
        err instanceof Error ? err.message : "Failed to update transaction",
      );
    } finally {
      setSavingTransaction(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(n);

  const inputStyle = {
    width: "100%",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "inherit",
  };

  if (loading)
    return (
      <div
        style={{
          maxWidth: pageWidth,
          margin: "0 auto",
          padding: "48px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div className="skeleton" style={{ height: "24px", width: "120px" }} />
        <div className="skeleton" style={{ height: "100px" }} />
        <div className="skeleton" style={{ height: "200px" }} />
      </div>
    );

  if (error)
    return (
      <div
        style={{ maxWidth: pageWidth, margin: "0 auto", padding: "48px 24px" }}
      >
        <p
          className="num"
          style={{ color: "#f87171", fontSize: "14px", marginBottom: "16px" }}
        >
          {error}
        </p>
        <Link href="/" style={{ color: "#f59e0b", fontSize: "14px" }}>
          ← Back to accounts
        </Link>
      </div>
    );

  if (!account) return null;

  const accentColor = ACCOUNT_TYPE_META[account.accountType].color;
  const transferTargets = accounts.filter((a) => a.id !== id);
  return (
    <div
      style={{ maxWidth: pageWidth, margin: "0 auto", padding: "48px 24px" }}
    >
      <DeleteTransaction
        accountId={id}
        pendingTransactionId={pendingDeleteTransactionId}
        onPendingChange={setPendingDeleteTransactionId}
        deletingTransactionId={deletingTransactionId}
        onDeletingChange={setDeletingTransactionId}
        editingTransactionId={editingTransactionId}
        onCancelEditing={cancelEditingTransaction}
        onDeleted={async () => {
          setOpSuccess("Transaction deleted");
          await refresh();
        }}
        onError={(msg) => setOpError(msg)}
      />

      <BackToHome />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: summaryColumns,
          gap: "16px",
          marginBottom: "16px",
          alignItems: "start",
        }}
      >
        <AccountCard
          account={account}
        />

        <NicknameEditor
          accountId={id}
          nickname={account.nickname}
          onUpdated={setAccount}
          onError={setOpError}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: detailColumns,
          gap: "16px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Charts */}
          {txns.length > 0 &&
            (() => {
              const chronological = [...txns].reverse();
              const balanceData = chronological.map((t) => ({
                timestamp: t.effectiveAt,
                balance: t.balanceAfter,
              }));

              const typeCounts: Record<string, number> = {};
              for (const t of txns)
                typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
              const typeLabels: Record<string, string> = {
                DEPOSIT:
                  account.accountType === "CREDIT" ? "Charge" : "Deposit",
                WITHDRAWAL:
                  account.accountType === "CREDIT" ? "Payment" : "Withdrawal",
                TRANSFER_OUT: "Transfer Out",
                TRANSFER_IN: "Transfer In",
              };
              const typeColors: Record<string, string> = {
                DEPOSIT: "#22c55e",
                WITHDRAWAL: "#f87171",
                TRANSFER_OUT: "#fb923c",
                TRANSFER_IN: "#60a5fa",
              };
              const donutData = Object.entries(typeCounts).map(
                ([type, value]) => ({
                  name: typeLabels[type] ?? type,
                  value,
                  color: typeColors[type] ?? "#888",
                }),
              );

              return (
                <div
                  className="fade-up fade-up-2"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    padding: "24px",
                    marginBottom: "16px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--text-secondary)",
                      marginBottom: "20px",
                    }}
                  >
                    Analytics
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: analyticsColumns,
                      gap: "24px",
                    }}
                  >
                    {/* Balance history */}
                    <div>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          marginBottom: "12px",
                        }}
                      >
                        Balance History
                      </p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart
                          data={balanceData}
                          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#ffffff08"
                          />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fontSize: 10, fill: "#6b7280" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) =>
                              new Date(value).toLocaleDateString("en-CA", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                            minTickGap={24}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "#6b7280" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `$${v}`}
                            width={48}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#1a1a1a",
                              border: "1px solid #2a2a2a",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                            labelStyle={{ color: "#9ca3af" }}
                            labelFormatter={(value) =>
                              new Date(value).toLocaleString("en-CA", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            }
                            formatter={(value) => [
                              fmt(Number(value)),
                              "Balance",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="balance"
                            stroke={accentColor}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: accentColor }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Transaction type breakdown */}
                    <div>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          marginBottom: "12px",
                        }}
                      >
                        Transaction Types
                      </p>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={42}
                            outerRadius={64}
                            dataKey="value"
                            paddingAngle={3}
                          >
                            {donutData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "#1a1a1a",
                              border: "1px solid #2a2a2a",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{
                              fontSize: "11px",
                              color: "#6b7280",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Operations */}
          {!account.frozen && (
            <div
              className="fade-up fade-up-2"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "16px",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-secondary)",
                  marginBottom: "16px",
                }}
              >
                New Transaction
              </p>

              {/* Op selector */}
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  background: "var(--surface-2)",
                  padding: "4px",
                  borderRadius: "10px",
                  marginBottom: "18px",
                  width: "fit-content",
                }}
              >
                {(["deposit", "withdraw", "transfer", "import"] as Op[]).map(
                  (o) => (
                    <button
                      key={o}
                      onClick={() => {
                        setOp(o);
                        setOpError(null);
                        setOpSuccess(null);
                        setCategory("");
                        setCustomCategory("");
                        setToId("");
                        setDescription("");
                      }}
                      style={{
                        padding: "8px 18px",
                        borderRadius: "7px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        transition: "all 0.15s",
                        background: op === o ? "#f59e0b" : "transparent",
                        color: op === o ? "#000" : "var(--text-secondary)",
                      }}
                    >
                      {account.accountType === "CREDIT" && o === "deposit"
                        ? "Charge"
                        : account.accountType === "CREDIT" && o === "withdraw"
                          ? "Payment"
                          : o.charAt(0).toUpperCase() + o.slice(1)}
                    </button>
                  ),
                )}
              </div>

              {op === "import" && (
                <ImportTab
                  accountId={id}
                  onSuccess={(imported) => {
                    setOpSuccess(
                      `Imported ${imported} transaction${imported !== 1 ? "s" : ""}`,
                    );
                    setOp("deposit");
                    setFilterDateRange(getPresetDateRange("all-time"));
                    refresh();
                  }}
                  onError={(msg) => setOpError(msg)}
                />
              )}

              {op !== "import" && (
                <form
                  onSubmit={handleSubmit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {op === "transfer" && (
                    <select
                      value={toId}
                      onChange={(e) => setToId(e.target.value)}
                      aria-label="Destination account"
                      disabled={transferTargets.length === 0}
                      style={{
                        ...inputStyle,
                        cursor:
                          transferTargets.length === 0
                            ? "not-allowed"
                            : "pointer",
                        appearance: "none",
                        color:
                          transferTargets.length === 0
                            ? "var(--text-muted)"
                            : "var(--text-primary)",
                      }}
                    >
                      <option value="">
                        {transferTargets.length === 0
                          ? "No other accounts available"
                          : "Choose destination account"}
                      </option>
                      {transferTargets.map((target) => {
                        const label = target.nickname ?? target.ownerName;
                        return (
                          <option key={target.id} value={target.id}>
                            {label} -{" "}
                            {ACCOUNT_TYPE_META[target.accountType].label} -{" "}
                            {target.id.slice(-6)}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <span
                        className="num"
                        style={{
                          position: "absolute",
                          left: "14px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-secondary)",
                          fontSize: "14px",
                          pointerEvents: "none",
                        }}
                      >
                        $
                      </span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        style={{ ...inputStyle, paddingLeft: "28px" }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={
                        submitting ||
                        (op === "transfer" && transferTargets.length === 0)
                      }
                      style={{
                        padding: "10px 24px",
                        background: "#f59e0b",
                        color: "#000",
                        fontWeight: 700,
                        fontSize: "14px",
                        border: "none",
                        borderRadius: "8px",
                        cursor:
                          submitting ||
                          (op === "transfer" && transferTargets.length === 0)
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          submitting ||
                          (op === "transfer" && transferTargets.length === 0)
                            ? 0.45
                            : 1,
                        transition: "opacity 0.15s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {submitting
                        ? "…"
                        : account.accountType === "CREDIT" && op === "deposit"
                          ? "Charge"
                          : account.accountType === "CREDIT" &&
                              op === "withdraw"
                            ? "Payment"
                            : op.charAt(0).toUpperCase() + op.slice(1)}
                    </button>
                  </div>
                  {op !== "transfer" ? (
                    <>
                      <select
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          setCustomCategory("");
                        }}
                        style={{
                          ...inputStyle,
                          cursor: "pointer",
                          appearance: "none",
                        }}
                      >
                        <option value="">Category (optional)</option>
                        <optgroup
                          label={
                            op === "deposit" && account.accountType !== "CREDIT"
                              ? "Income"
                              : "Expenses"
                          }
                        >
                          {(op === "deposit" && account.accountType !== "CREDIT"
                            ? INCOME_CATEGORIES
                            : EXPENSE_CATEGORIES
                          ).map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>
                        <option value="Custom...">Custom...</option>
                      </select>
                      {category === "Custom..." && (
                        <input
                          type="text"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="Enter custom category"
                          style={inputStyle}
                          autoFocus
                        />
                      )}
                      <input
                        type="text"
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        placeholder="Merchant (optional)"
                        style={inputStyle}
                      />
                    </>
                  ) : (
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Description (optional)"
                      style={inputStyle}
                    />
                  )}
                </form>
              )}

              {opError && (
                <p
                  className="num"
                  style={{
                    color: "#f87171",
                    fontSize: "12px",
                    marginTop: "10px",
                  }}
                >
                  {opError}
                </p>
              )}
              {opSuccess && (
                <p
                  className="num"
                  style={{
                    color: "#22c55e",
                    fontSize: "12px",
                    marginTop: "10px",
                  }}
                >
                  {opSuccess}
                </p>
              )}
            </div>
          )}

          {account.frozen && (
            <div
              className="fade-up fade-up-2"
              style={{
                border: "1px solid #3b82f630",
                background: "#3b82f608",
                borderRadius: "12px",
                padding: "16px 20px",
                marginBottom: "16px",
              }}
            >
              <p style={{ color: "#60a5fa", fontSize: "14px" }}>
                This account is frozen. All transactions have been suspended.
              </p>
            </div>
          )}
        </div>

        <TransactionHistory
          txns={txns}
          account={account}
          timeZone={timeZone}
          isDoubleColumn={isDoubleColumn}
          historyFilterColumns={historyFilterColumns}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          filterCategory={filterCategory}
          onFilterCategoryChange={setFilterCategory}
          filterSearch={filterSearch}
          onFilterSearchChange={setFilterSearch}
          filterDateRange={filterDateRange}
          onFilterDateRangeChange={setFilterDateRange}
          editingTransactionId={editingTransactionId}
          editingTransactionAmount={editingTransactionAmount}
          onEditingTransactionAmountChange={setEditingTransactionAmount}
          editingTransactionCategory={editingTransactionCategory}
          onEditingTransactionCategoryChange={setEditingTransactionCategory}
          editingTransactionMerchant={editingTransactionMerchant}
          onEditingTransactionMerchantChange={setEditingTransactionMerchant}
          editingTransactionDateTime={editingTransactionDateTime}
          onEditingTransactionDateTimeChange={setEditingTransactionDateTime}
          savingTransaction={savingTransaction}
          deletingTransactionId={deletingTransactionId}
          onStartEditing={startEditingTransaction}
          onCancelEditing={cancelEditingTransaction}
          onSaveTransaction={handleSaveTransaction}
          onRequestDelete={setPendingDeleteTransactionId}
        />
      </div>
    </div>
  );
}
