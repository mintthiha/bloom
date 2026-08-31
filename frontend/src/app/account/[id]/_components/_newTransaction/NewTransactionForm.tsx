"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, Account, AutoCategorizationRule, Profile, Transaction } from "@/lib/api";
import { ImportTab } from "../_import/ImportTab";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { inputStyle } from "@/lib/styles/input";
import {
  calculateNetContributions,
  calculateNetContributionsForYear,
} from "@/lib/contribution-room";
import {
  evaluateTfsaContribution,
  evaluateRrspContribution,
  evaluateFhsaContribution,
  type OverContributionWarning,
} from "@/lib/over-contribution";

type Op = "deposit" | "withdraw" | "transfer" | "import";

const REGISTERED_ACCOUNT_TYPES = new Set(["TFSA", "RRSP", "FHSA"]);

interface NewTransactionFormProps {
  account: Account;
  transferTargets: Account[];
  onSuccess: () => Promise<void>;
  onImportSuccess: (imported: number) => void;
  profile: Profile | null;
  transactionsForType: Transaction[];
  sameTypeAccountIds: string[];
}

/** New transaction panel — deposit/withdraw/transfer/import form, or frozen banner if account is frozen. */
export function NewTransactionForm({
  account,
  transferTargets,
  onSuccess,
  onImportSuccess,
  profile,
  transactionsForType,
  sameTypeAccountIds,
}: NewTransactionFormProps) {
  const isMobile = useIsMobile();
  const [op, setOp] = useState<Op>("deposit");
  const [amount, setAmount] = useState("");
  const [toId, setToId] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [categorizationRules, setCategorizationRules] = useState<AutoCategorizationRule[]>([]);

  /** Loads the user's auto-categorization rules once on mount. */
  useEffect(() => {
    api
      .listCategorizationRules()
      .then(setCategorizationRules)
      .catch(() => {});
  }, []);

  const currentYear = new Date().getFullYear();
  const isRegisteredType = REGISTERED_ACCOUNT_TYPES.has(account.accountType);

  // Net contributions across all same-type accounts, used for warning calculations
  const netContributionsForType = isRegisteredType
    ? calculateNetContributions(transactionsForType, sameTypeAccountIds)
    : 0;
  const netFhsaContributionsThisYear =
    account.accountType === "FHSA"
      ? calculateNetContributionsForYear(transactionsForType, sameTypeAccountIds, currentYear)
      : 0;

  /** Computes the inline over-contribution warning for the current deposit amount. Returns null when not applicable. */
  function computeOverContributionWarning(): OverContributionWarning | null {
    if (op !== "deposit" || !isRegisteredType) return null;
    const amtValue = parseFloat(amount) || 0;
    if (account.accountType === "TFSA") {
      return evaluateTfsaContribution({
        contributionAmount: amtValue,
        birthYear: profile?.tfsaBirthYear ?? null,
        currentYear,
        roomUsedElsewhere: profile?.tfsaRoomUsedElsewhere ?? null,
        netTfsaContributionsInBloom: netContributionsForType,
      });
    }
    if (account.accountType === "RRSP") {
      return evaluateRrspContribution({
        contributionAmount: amtValue,
        rrspContributionRoom: profile?.rrspContributionRoom ?? null,
        netRrspContributionsInBloom: netContributionsForType,
      });
    }
    if (account.accountType === "FHSA") {
      return evaluateFhsaContribution({
        contributionAmount: amtValue,
        currentYear,
        netFhsaContributionsThisYear: netFhsaContributionsThisYear,
        netFhsaContributionsLifetime: netContributionsForType,
      });
    }
    return null;
  }

  const overContributionWarning = computeOverContributionWarning();

  const enteredAmount = parseFloat(amount);
  /** True when a withdrawal would exceed the current balance on a non-credit account. */
  const wouldOverdraw =
    op === "withdraw" &&
    account.accountType !== "CREDIT" &&
    !isNaN(enteredAmount) &&
    enteredAmount > account.balance;

  /**
   * Updates the merchant field and auto-fills the category when a user rule matches
   * and the user has not already selected a category.
   */
  function handleMerchantChange(value: string) {
    setMerchant(value);
    if (!category) {
      const matched = categorizationRules.find(
        (r) => r.merchant.toLowerCase() === value.toLowerCase()
      );
      if (matched) setCategory(matched.category);
    }
  }

  /** Submits a deposit, withdrawal, or transfer based on the selected op. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid positive amount");
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
        category === "Custom..." ? customCategory.trim() || undefined : category || undefined;
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
          toast.error("Choose a destination account");
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
      toast.success(`${opDisplayName} successful`);

      // Fire a persistent warning toast when the deposit pushed the user over their estimated room
      if (op === "deposit" && overContributionWarning?.severity === "red") {
        const limitName =
          account.accountType === "FHSA"
            ? "FHSA contribution limit"
            : account.accountType === "RRSP"
              ? "RRSP deduction limit"
              : "TFSA room";
        toast.warning(
          `Heads up: you may now be over your estimated ${limitName}. Review your contributions on the CRA's My Account portal to confirm.`,
          { duration: 10000 }
        );
      }

      setAmount("");
      setToId("");
      setDescription("");
      setMerchant("");
      setCategory("");
      setCustomCategory("");
      await onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
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
          width: isMobile ? "100%" : "fit-content",
        }}
      >
        {(["deposit", "withdraw", "transfer", "import"] as Op[]).map((o) => (
          <button
            key={o}
            onClick={() => {
              setOp(o);
              setCategory("");
              setCustomCategory("");
              setToId("");
              setDescription("");
            }}
            style={{
              flex: isMobile ? 1 : undefined,
              padding: isMobile ? "8px 10px" : "8px 18px",
              borderRadius: "7px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "all 0.15s",
              background: op === o ? "#3b82f6" : "transparent",
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

      <div style={{ display: op === "import" ? "block" : "none" }}>
        <ImportTab
          accountId={account.id}
          onSuccess={(imported) => {
            onImportSuccess(imported);
            setOp("deposit");
          }}
          onError={(msg) => toast.error(msg)}
          categorizationRules={categorizationRules}
        />
      </div>

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
                cursor: transferTargets.length === 0 ? "not-allowed" : "pointer",
                appearance: "none",
                color: transferTargets.length === 0 ? "var(--text-muted)" : "var(--text-primary)",
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
                    {label} — {ACCOUNT_TYPE_META[target.accountType].label} — {target.id.slice(-6)}
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
              className="press"
              disabled={submitting || (op === "transfer" && transferTargets.length === 0) || wouldOverdraw}
              style={{
                padding: "10px 24px",
                background: "#3b82f6",
                color: "#000",
                fontWeight: 700,
                fontSize: "14px",
                border: "none",
                borderRadius: "8px",
                cursor:
                  submitting || (op === "transfer" && transferTargets.length === 0) || wouldOverdraw
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  submitting || (op === "transfer" && transferTargets.length === 0) || wouldOverdraw
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

          {wouldOverdraw && (
            <p style={{ fontSize: "12px", color: "#ef4444", margin: 0 }}>
              Insufficient funds — balance is ${account.balance.toFixed(2)}.
            </p>
          )}

          {overContributionWarning && overContributionWarning.severity !== "none" && (
            <div
              style={{
                border: `1px solid ${overContributionWarning.severity === "red" ? "#ef4444" : "#3b82f6"}`,
                background: overContributionWarning.severity === "red" ? "#ef444408" : "#3b82f608",
                borderRadius: "12px",
                padding: "16px 20px",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: overContributionWarning.severity === "red" ? "#f87171" : "#d97706",
                  margin: 0,
                }}
              >
                {overContributionWarning.message}
              </p>
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 400,
                  color: overContributionWarning.severity === "red" ? "#f87171" : "#d97706",
                  margin: "4px 0 0",
                }}
              >
                {overContributionWarning.detail}
              </p>
            </div>
          )}

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
                    op === "deposit" && account.accountType !== "CREDIT" ? "Income" : "Expenses"
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
                onChange={(e) => handleMerchantChange(e.target.value)}
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
    </div>
  );
}
