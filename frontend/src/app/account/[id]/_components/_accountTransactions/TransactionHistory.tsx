"use client";
import { useState, useEffect } from "react";
import { Transaction, Account } from "@/lib/api";
import { DateRangeControls } from "@/components/date-range-controls";
import { DateRangeState } from "@/lib/date-range";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  TRANSACTION_FILTER_CATEGORIES,
} from "@/lib/constants/account";
import { Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { inputStyle } from "@/lib/styles/input";
import { EmptyState } from "@/components/EmptyState";
import { ExportCsvButton } from "./ExportCsvButton";

const PAGE_SIZE = 4;

interface TransactionHistoryProps {
  txns: Transaction[];
  account: Account;
  timeZone: string;
  isDoubleColumn: boolean;
  historyFilterColumns: string;
  filterType: "ALL" | Transaction["type"];
  onFilterTypeChange: (type: "ALL" | Transaction["type"]) => void;
  filterCategory: string;
  onFilterCategoryChange: (cat: string) => void;
  filterSearch: string;
  onFilterSearchChange: (search: string) => void;
  filterDateRange: DateRangeState;
  onFilterDateRangeChange: (range: DateRangeState) => void;
  editingTransactionId: string | null;
  editingTransactionAmount: string;
  onEditingTransactionAmountChange: (v: string) => void;
  editingTransactionCategory: string;
  onEditingTransactionCategoryChange: (v: string) => void;
  editingTransactionMerchant: string;
  onEditingTransactionMerchantChange: (v: string) => void;
  editingTransactionDateTime: string;
  onEditingTransactionDateTimeChange: (v: string) => void;
  savingTransaction: boolean;
  deletingTransactionId: string | null;
  onStartEditing: (transaction: Transaction) => void;
  onCancelEditing: () => void;
  onSaveTransaction: (transactionId: string) => void;
  onRequestDelete: (transactionId: string) => void;
}

/** Returns display metadata for a transaction row based on type and account kind. */
function txnMeta(
  t: Transaction,
  isCredit = false
): { label: string; color: string; sign: string; icon: string } {
  switch (t.type) {
    case "DEPOSIT":
      return isCredit
        ? { label: "Charge", color: "#f87171", sign: "+", icon: "↑" }
        : { label: "Deposit", color: "#22c55e", sign: "+", icon: "↓" };
    case "WITHDRAWAL":
      return isCredit
        ? { label: "Payment", color: "#22c55e", sign: "−", icon: "↓" }
        : { label: "Withdrawal", color: "#f87171", sign: "−", icon: "↑" };
    case "TRANSFER_OUT":
      return {
        label: "Transfer out",
        color: "#fb923c",
        sign: "−",
        icon: "→",
      };
    case "TRANSFER_IN":
      return { label: "Transfer in", color: "#22c55e", sign: "+", icon: "←" };
  }
}

/** Returns true for transaction types that support inline editing. */
function isEditableTransaction(transaction: Transaction): boolean {
  return (
    transaction.type === "DEPOSIT" ||
    transaction.type === "WITHDRAWAL" ||
    ((transaction.type === "TRANSFER_OUT" || transaction.type === "TRANSFER_IN") &&
      Boolean(transaction.transferGroupId))
  );
}

/** Renders the full transaction history panel with filters, pagination, and inline editing. */
export function TransactionHistory({
  txns,
  account,
  timeZone,
  isDoubleColumn,
  historyFilterColumns,
  filterType,
  onFilterTypeChange,
  filterCategory,
  onFilterCategoryChange,
  filterSearch,
  onFilterSearchChange,
  filterDateRange,
  onFilterDateRangeChange,
  editingTransactionId,
  editingTransactionAmount,
  onEditingTransactionAmountChange,
  editingTransactionCategory,
  onEditingTransactionCategoryChange,
  editingTransactionMerchant,
  onEditingTransactionMerchantChange,
  editingTransactionDateTime,
  onEditingTransactionDateTimeChange,
  savingTransaction,
  deletingTransactionId,
  onStartEditing,
  onCancelEditing,
  onSaveTransaction,
  onRequestDelete,
}: TransactionHistoryProps) {
  const [page, setPage] = useState(1);

  /** Resets to page 1 when filters change or the result set size changes (add/delete). */
  useEffect(() => {
    setPage(1);
  }, [filterType, filterCategory, filterSearch, filterDateRange, txns.length]);

  const totalPages = Math.max(1, Math.ceil(txns.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTxns = txns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div
      className="fade-up fade-up-3"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "24px",
        minHeight: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-secondary)",
            }}
          >
            Transaction History
          </p>
          <p
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginTop: "6px",
            }}
          >
            Times shown in {timeZone}.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {txns.length} records
          </span>
          <ExportCsvButton txns={txns} account={account} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: historyFilterColumns,
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <select
          aria-label="Transaction type filter"
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value as "ALL" | Transaction["type"])}
          style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
        >
          <option value="ALL">All types</option>
          <option value="DEPOSIT">{account.accountType === "CREDIT" ? "Charge" : "Deposit"}</option>
          <option value="WITHDRAWAL">
            {account.accountType === "CREDIT" ? "Payment" : "Withdrawal"}
          </option>
          <option value="TRANSFER_OUT">Transfer out</option>
          <option value="TRANSFER_IN">Transfer in</option>
        </select>
        <select
          aria-label="Transaction category filter"
          value={filterCategory}
          onChange={(e) => onFilterCategoryChange(e.target.value)}
          style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
        >
          <option value="ALL">All categories</option>
          <option value="Uncategorized">Uncategorized</option>
          {TRANSACTION_FILTER_CATEGORIES.map((categoryOption) => (
            <option key={categoryOption} value={categoryOption}>
              {categoryOption}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Transaction search"
          value={filterSearch}
          onChange={(e) => onFilterSearchChange(e.target.value)}
          placeholder="Search description or merchant"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: "18px" }}>
        <DateRangeControls value={filterDateRange} onChange={onFilterDateRangeChange} />
      </div>

      {txns.length === 0 ? (
        <EmptyState
          icon={Receipt}
          variant="inline"
          title="No transactions yet"
          description="Deposits, withdrawals, and transfers on this account will show up here."
        />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {pagedTxns.map((t) => {
              const { label, color, sign, icon } = txnMeta(t, account.accountType === "CREDIT");
              const isEditing = editingTransactionId === t.id;
              const canEdit = isEditableTransaction(t);
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: isEditing ? "stretch" : "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    transition: "background 0.1s",
                    gap: "16px",
                    flexWrap: isEditing ? "wrap" : "nowrap",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: isEditing ? "flex-start" : "center",
                      gap: "14px",
                      flex: isEditing ? "1 1 100%" : 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "8px",
                        flexShrink: 0,
                        background: `${color}18`,
                        border: `1px solid ${color}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 700,
                        color,
                      }}
                    >
                      {icon}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {isEditing ? (
                        <div
                          style={{
                            display: "grid",
                            gap: "12px",
                            width: "100%",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: isDoubleColumn
                                ? "minmax(0, 180px) minmax(0, 1fr)"
                                : "1fr",
                              gap: "12px",
                              alignItems: "start",
                            }}
                          >
                            <label style={{ display: "grid", gap: "6px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                Amount
                              </span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={editingTransactionAmount}
                                onChange={(e) => onEditingTransactionAmountChange(e.target.value)}
                                aria-label="Transaction amount"
                                style={inputStyle}
                              />
                            </label>
                            <label style={{ display: "grid", gap: "6px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                Category
                              </span>
                              <select
                                value={editingTransactionCategory}
                                onChange={(e) => onEditingTransactionCategoryChange(e.target.value)}
                                aria-label="Transaction category"
                                style={{
                                  ...inputStyle,
                                  cursor: "pointer",
                                  appearance: "none",
                                  width: "100%",
                                }}
                              >
                                <option value="">No category</option>
                                {(t.type === "DEPOSIT" && account.accountType !== "CREDIT"
                                  ? INCOME_CATEGORIES
                                  : t.type === "WITHDRAWAL" ||
                                      (t.type === "DEPOSIT" && account.accountType === "CREDIT")
                                    ? EXPENSE_CATEGORIES
                                    : ["Transfer"]
                                ).map((categoryOption) => (
                                  <option key={categoryOption} value={categoryOption}>
                                    {categoryOption}
                                  </option>
                                ))}
                                {editingTransactionCategory &&
                                  !(
                                    t.type === "DEPOSIT" && account.accountType !== "CREDIT"
                                      ? INCOME_CATEGORIES
                                      : t.type === "WITHDRAWAL" ||
                                          (t.type === "DEPOSIT" && account.accountType === "CREDIT")
                                        ? EXPENSE_CATEGORIES
                                        : ["Transfer"]
                                  ).includes(editingTransactionCategory) && (
                                    <option value={editingTransactionCategory}>
                                      {editingTransactionCategory}
                                    </option>
                                  )}
                              </select>
                            </label>
                          </div>
                          <label
                            style={{
                              display: "grid",
                              gap: "6px",
                              maxWidth: isDoubleColumn ? "320px" : "100%",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: "var(--text-secondary)",
                              }}
                            >
                              Merchant
                            </span>
                            <input
                              type="text"
                              value={editingTransactionMerchant}
                              onChange={(e) => onEditingTransactionMerchantChange(e.target.value)}
                              aria-label="Transaction merchant"
                              placeholder="Merchant"
                              style={inputStyle}
                            />
                          </label>
                          <label
                            style={{
                              display: "grid",
                              gap: "6px",
                              maxWidth: isDoubleColumn ? "260px" : "100%",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: "var(--text-secondary)",
                              }}
                            >
                              Date and time
                            </span>
                            <input
                              type="datetime-local"
                              value={editingTransactionDateTime}
                              onChange={(e) => onEditingTransactionDateTimeChange(e.target.value)}
                              aria-label="Transaction date and time"
                              style={inputStyle}
                            />
                          </label>
                          <p
                            className="num"
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                            }}
                          >
                            Recorded{" "}
                            {new Date(t.createdAt).toLocaleString("en-CA", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                      ) : (
                        <>
                          <p
                            style={{
                              fontWeight: 600,
                              fontSize: "14px",
                              marginBottom: "3px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {t.merchant || t.description || label}
                          </p>
                          <p
                            className="num"
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                            }}
                          >
                            {(t.merchant || t.description) && (
                              <span
                                style={{
                                  color: "var(--text-secondary)",
                                  marginRight: "8px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  fontSize: "10px",
                                }}
                              >
                                {label}
                              </span>
                            )}
                            {t.category && (
                              <span
                                style={{
                                  color: "var(--text-secondary)",
                                  marginRight: "8px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  fontSize: "10px",
                                }}
                              >
                                {t.category}
                              </span>
                            )}
                            {t.merchant && (
                              <span
                                style={{
                                  color: "var(--text-secondary)",
                                  marginRight: "8px",
                                  fontSize: "10px",
                                }}
                              >
                                {t.merchant}
                              </span>
                            )}
                            {!t.merchant && t.description && (
                              <span
                                style={{
                                  color: "var(--text-secondary)",
                                  marginRight: "8px",
                                  fontSize: "10px",
                                }}
                              >
                                {t.description}
                              </span>
                            )}
                            {new Date(t.effectiveAt).toLocaleString("en-CA", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: isEditing ? "left" : "right",
                      flexShrink: 0,
                      minWidth: isEditing ? "100%" : "160px",
                      marginLeft: isEditing ? "48px" : "0",
                    }}
                  >
                    {isEditing ? (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-start",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => onSaveTransaction(t.id)}
                          disabled={savingTransaction}
                          style={{
                            padding: "8px 12px",
                            background: "#f59e0b",
                            color: "#000",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: savingTransaction ? "not-allowed" : "pointer",
                            opacity: savingTransaction ? 0.45 : 1,
                          }}
                        >
                          {savingTransaction ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEditing}
                          disabled={savingTransaction}
                          style={{
                            padding: "8px 12px",
                            border: "1px solid var(--border)",
                            background: "transparent",
                            color: "var(--text-secondary)",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: savingTransaction ? "not-allowed" : "pointer",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestDelete(t.id)}
                          disabled={savingTransaction || deletingTransactionId === t.id}
                          style={{
                            padding: "6px 10px",
                            border: "1px solid #f8717130",
                            background: "transparent",
                            color: "#f87171",
                            borderRadius: "8px",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor:
                              savingTransaction || deletingTransactionId === t.id
                                ? "not-allowed"
                                : "pointer",
                            opacity: savingTransaction || deletingTransactionId === t.id ? 0.45 : 1,
                          }}
                        >
                          {deletingTransactionId === t.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <p
                          className="num"
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color,
                            marginBottom: "3px",
                          }}
                        >
                          {sign} {formatCurrency(t.amount)}
                        </p>
                        <p
                          className="num"
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            marginBottom: canEdit ? "10px" : "0",
                          }}
                        >
                          {formatCurrency(t.balanceAfter)}
                        </p>
                      </>
                    )}

                    {canEdit ? (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "8px",
                        }}
                      >
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => onStartEditing(t)}
                            disabled={savingTransaction || deletingTransactionId === t.id}
                            style={{
                              padding: "6px 10px",
                              border: "1px solid var(--border)",
                              background: "transparent",
                              color: "var(--text-secondary)",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor:
                                savingTransaction || deletingTransactionId === t.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                savingTransaction || deletingTransactionId === t.id ? 0.45 : 1,
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => onRequestDelete(t.id)}
                            disabled={savingTransaction || deletingTransactionId === t.id}
                            style={{
                              padding: "6px 10px",
                              border: "1px solid #f8717130",
                              background: "transparent",
                              color: "#f87171",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor:
                                savingTransaction || deletingTransactionId === t.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                savingTransaction || deletingTransactionId === t.id ? 0.45 : 1,
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

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "16px",
                borderTop: "1px solid var(--border)",
                marginTop: "8px",
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "6px 12px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: currentPage === 1 ? "var(--text-muted)" : "var(--text-secondary)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                ← Prev
              </button>
              <span className="num" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: "6px 12px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: currentPage === totalPages ? "var(--text-muted)" : "var(--text-secondary)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
