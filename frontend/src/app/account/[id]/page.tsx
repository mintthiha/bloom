"use client";
import { useState, useEffect, useCallback, use, useMemo } from "react";
import Link from "next/link";
import { api, Account, DateRangeQuery, Transaction } from "@/lib/api";
import { BackToHome } from "./_components/_accountActions/BackToHome";
import { useDashboardView } from "@/components/dashboard-view-provider";
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
import { AccountAnalytics } from "./_components/_accountAnalytics/AccountAnalytics";
import { NewTransactionForm } from "./_components/_newTransaction/NewTransactionForm";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";

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
  const [opError, setOpError] = useState<string | null>(null);
  const [opSuccess, setOpSuccess] = useState<string | null>(null);
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
        <AccountCard account={account} onRefresh={refresh} />

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
          {txns.length > 0 && (
            <AccountAnalytics
              txns={txns}
              accountType={account.accountType}
              analyticsColumns={analyticsColumns}
              accentColor={accentColor}
            />
          )}

          <NewTransactionForm
            account={account}
            transferTargets={transferTargets}
            onSuccess={refresh}
            onImportSuccess={(imported) => {
              setOpSuccess(
                `Imported ${imported} transaction${imported !== 1 ? "s" : ""}`,
              );
              setFilterDateRange(getPresetDateRange("all-time"));
              refresh();
            }}
            feedback={{
              error: opError,
              success: opSuccess,
              setError: setOpError,
              setSuccess: setOpSuccess,
            }}
          />
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
