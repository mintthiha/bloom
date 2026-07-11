"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, Account, AccountType, SavingsGoal } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { inputStyle } from "@/lib/styles/input";

type GoalFormDialogProps = {
  goal: SavingsGoal | null;
  onClose: () => void;
  onSaved: (goal: SavingsGoal) => void;
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const panelStyle: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  padding: "28px",
  width: "420px",
  maxWidth: "90vw",
  boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-secondary)",
  marginBottom: "8px",
};

/** Formats an account option label showing name, type, and current balance. */
function accountOptionLabel(account: Account): string {
  const name = account.nickname ?? account.ownerName;
  const typeMeta = ACCOUNT_TYPE_META[account.accountType as AccountType];
  return `${name} — ${typeMeta.label} · ${formatCurrency(account.balance)}`;
}

/** Dialog for creating or editing a savings goal. */
export function GoalFormDialog({ goal, onClose, onSaved }: GoalFormDialogProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState(goal?.name ?? "");
  const [selectedAccountId, setSelectedAccountId] = useState(goal?.accountId ?? "");
  const [targetAmountInput, setTargetAmountInput] = useState(goal ? String(goal.targetAmount) : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Fetches the user's accounts to populate the account selector. */
  useEffect(() => {
    api
      .listAccounts()
      .then((data) => {
        setAccounts(data);
        if (!selectedAccountId && data.length > 0) {
          setSelectedAccountId(data[0]!.id);
        }
      })
      .catch(() => {});
  }, []);

  /** Submits the form to create or update the savings goal. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetAmount = parseFloat(targetAmountInput);
    if (!name.trim()) {
      toast.error("Goal name is required.");
      return;
    }
    if (!selectedAccountId) {
      toast.error("Please select an account.");
      return;
    }
    if (isNaN(targetAmount) || targetAmount <= 0) {
      toast.error("Target amount must be a positive number.");
      return;
    }
    setIsSubmitting(true);
    try {
      const saved = goal
        ? await api.updateSavingsGoal(goal.id, {
            accountId: selectedAccountId,
            name: name.trim(),
            targetAmount,
          })
        : await api.createSavingsGoal({
            accountId: selectedAccountId,
            name: name.trim(),
            targetAmount,
          });
      onSaved(saved);
      toast.success(goal ? "Goal updated." : "Goal created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save goal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "22px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            {goal ? "Edit goal" : "New savings goal"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: "18px",
              lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div>
            <label style={labelStyle}>Goal name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emergency Fund"
              maxLength={100}
              style={{ ...inputStyle, borderRadius: "10px" }}
            />
          </div>

          <div>
            <label style={labelStyle}>Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={{ ...inputStyle, borderRadius: "10px", cursor: "pointer", appearance: "none" }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountOptionLabel(account)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Target amount</label>
            <input
              type="number"
              value={targetAmountInput}
              onChange={(e) => setTargetAmountInput(e.target.value)}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              style={{ ...inputStyle, borderRadius: "10px" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "4px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                color: "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="press"
              disabled={isSubmitting}
              style={{
                padding: "10px 18px",
                background: "#f59e0b",
                border: "none",
                borderRadius: "10px",
                color: "#000",
                fontSize: "13px",
                fontWeight: 700,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.55 : 1,
              }}
            >
              {isSubmitting ? "Saving..." : "Save goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
