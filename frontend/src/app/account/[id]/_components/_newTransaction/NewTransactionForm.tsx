"use client";

import { useState } from "react";
import { api, Account } from "@/lib/api";
import { ImportTab } from "../_import/ImportTab";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  ACCOUNT_TYPE_META,
} from "@/lib/constants/account";
import { FeedbackState } from "@/lib/types";

type Op = "deposit" | "withdraw" | "transfer" | "import";

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

interface NewTransactionFormProps {
  account: Account;
  transferTargets: Account[];
  onSuccess: () => Promise<void>;
  onImportSuccess: (imported: number) => void;
  feedback: FeedbackState;
}

/** New transaction panel — deposit/withdraw/transfer/import form, or frozen banner if account is frozen. */
export function NewTransactionForm({
  account,
  transferTargets,
  onSuccess,
  onImportSuccess,
  feedback,
}: NewTransactionFormProps) {
  const [op, setOp] = useState<Op>("deposit");
  const [amount, setAmount] = useState("");
  const [toId, setToId] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");

  /** Submits a deposit, withdrawal, or transfer based on the selected op. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    feedback.setError(null);
    feedback.setSuccess(null);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      feedback.setError("Enter a valid positive amount");
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
        await api.deposit(account.id, amt, {
          category: transactionCategory,
          merchant: transactionMerchant,
        });
      if (op === "withdraw")
        await api.withdraw(account.id, amt, {
          category: transactionCategory,
          merchant: transactionMerchant,
        });
      if (op === "transfer") {
        if (!toId.trim()) {
          feedback.setError("Choose a destination account");
          setSubmitting(false);
          return;
        }
        await api.transfer(account.id, toId.trim(), amt, desc);
      }
      const opDisplayName =
        account.accountType === "CREDIT" && op === "deposit"
          ? "Charge"
          : account.accountType === "CREDIT" && op === "withdraw"
            ? "Payment"
            : op.charAt(0).toUpperCase() + op.slice(1);
      feedback.setSuccess(`${opDisplayName} successful`);
      setAmount("");
      setToId("");
      setDescription("");
      setMerchant("");
      setCategory("");
      setCustomCategory("");
      await onSuccess();
    } catch (err) {
      feedback.setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (account.frozen) {
    return (
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
    );
  }

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
          marginBottom: "16px",
        }}
      >
        New Transaction
      </p>

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
        {(["deposit", "withdraw", "transfer", "import"] as Op[]).map((o) => (
          <button
            key={o}
            onClick={() => {
              setOp(o);
              feedback.setError(null);
              feedback.setSuccess(null);
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
        ))}
      </div>

      {op === "import" && (
        <ImportTab
          accountId={account.id}
          onSuccess={(imported) => {
            onImportSuccess(imported);
            setOp("deposit");
          }}
          onError={(msg) => feedback.setError(msg)}
        />
      )}

      {op !== "import" && (
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "10px" }}
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
                  transferTargets.length === 0 ? "not-allowed" : "pointer",
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
                    {label} — {ACCOUNT_TYPE_META[target.accountType].label} —{" "}
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
                  : account.accountType === "CREDIT" && op === "withdraw"
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
                style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
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

      {feedback.error && (
        <p
          className="num"
          style={{ color: "#f87171", fontSize: "12px", marginTop: "10px" }}
        >
          {feedback.error}
        </p>
      )}
      {feedback.success && (
        <p
          className="num"
          style={{ color: "#22c55e", fontSize: "12px", marginTop: "10px" }}
        >
          {feedback.success}
        </p>
      )}
    </div>
  );
}
