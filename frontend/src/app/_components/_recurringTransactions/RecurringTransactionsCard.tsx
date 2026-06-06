"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  api,
  Account,
  RecurringFrequency,
  RecurringTransaction,
  RecurringTransactionType,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { formatLocalDate } from "@/lib/date-range";
import { CollapsibleCard } from "@/components/collapsible-card";
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

const DEPOSIT_CATEGORIES = [
  "Salary",
  "Freelance",
  "Gift",
  "Investment",
  "Other Income",
  "Custom...",
];
const WITHDRAWAL_CATEGORIES = [
  "Rent",
  "Utilities",
  "Transport",
  "Dining",
  "Healthcare",
  "Entertainment",
  "Other",
  "Custom...",
];

type Props = {
  rules: RecurringTransaction[];
  accounts: Account[];
  onChanged: () => Promise<void>;
};

/** Resets all recurring rule form fields to their default values. */
function makeEmptyForm() {
  return {
    accountId: "",
    name: "",
    type: "WITHDRAWAL" as RecurringTransactionType,
    amount: "",
    category: "Rent",
    customCategory: "",
    merchant: "",
    description: "",
    frequency: "MONTHLY" as RecurringFrequency,
    startDate: formatLocalDate(new Date()),
    endDate: "",
  };
}

/** Recurring transactions card: create/edit/pause/delete recurring rules. */
export function RecurringTransactionsCard({
  rules,
  accounts,
  onChanged,
}: Props) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState(makeEmptyForm);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteRule, setPendingDeleteRule] =
    useState<RecurringTransaction | null>(null);

  const recurringAccounts = accounts.filter(
    (account) => account.accountType !== "CREDIT"
  );
  const recurringCategories =
    form.type === "DEPOSIT" ? DEPOSIT_CATEGORIES : WITHDRAWAL_CATEGORIES;
  const dueCount = rules.filter(
    (rule) => rule.active && new Date(rule.nextRunAt) <= new Date()
  ).length;

  /** Sets the default accountId once accounts load, if no account is selected. */
  useEffect(() => {
    if (!form.accountId && recurringAccounts.length > 0) {
      setForm((previous) => ({
        ...previous,
        accountId: recurringAccounts[0]!.id,
      }));
    }
  }, [accounts]);

  /** Clears the form and exits editing mode. */
  function resetForm() {
    setEditingRuleId(null);
    setError(null);
    setForm(makeEmptyForm());
  }

  /** Populates the form with an existing rule's values for editing. */
  function startEditing(rule: RecurringTransaction) {
    setError(null);
    setEditingRuleId(rule.id);

    const supportedCategories =
      rule.type === "DEPOSIT" ? DEPOSIT_CATEGORIES : WITHDRAWAL_CATEGORIES;
    const isKnownCategory =
      rule.category != null && supportedCategories.includes(rule.category);

    setForm({
      accountId: rule.accountId,
      name: rule.name,
      type: rule.type,
      amount: rule.amount.toString(),
      category: isKnownCategory
        ? rule.category!
        : rule.category
        ? "Custom..."
        : rule.type === "DEPOSIT"
        ? "Salary"
        : "Rent",
      customCategory: isKnownCategory ? "" : (rule.category ?? ""),
      merchant: rule.merchant ?? "",
      description: rule.description ?? "",
      frequency: rule.frequency,
      startDate: rule.startDate.slice(0, 10),
      endDate: rule.endDate?.slice(0, 10) ?? "",
    });
  }

  /** Validates and saves a new or updated recurring rule via the API. */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(form.amount);
    const category =
      form.category === "Custom..." ? form.customCategory.trim() : form.category;

    if (!form.accountId) {
      setError("Choose an account");
      return;
    }
    if (!form.name.trim()) {
      setError("Enter a rule name");
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Enter a valid recurring amount");
      return;
    }
    if (!form.startDate) {
      setError("Choose a start date");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        accountId: form.accountId,
        name: form.name.trim(),
        type: form.type,
        amount,
        category: category || undefined,
        merchant: form.merchant.trim() || undefined,
        description: form.description.trim() || undefined,
        frequency: form.frequency,
        startDate: new Date(`${form.startDate}T12:00:00`).toISOString(),
        endDate: form.endDate
          ? new Date(`${form.endDate}T12:00:00`).toISOString()
          : undefined,
      };

      if (editingRuleId) {
        await api.updateRecurringTransaction(editingRuleId, payload);
        toast.success("Recurring rule updated");
      } else {
        await api.createRecurringTransaction(payload);
        toast.success("Recurring rule created");
      }

      resetForm();
      await onChanged();
      window.dispatchEvent(new CustomEvent("recurring-changed"));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save recurring transaction"
      );
    } finally {
      setSaving(false);
    }
  }

  /** Applies all due recurring transactions and refreshes account data. */
  async function handleApplyDue() {
    setApplying(true);
    setError(null);
    try {
      const result = await api.applyDueRecurringTransactions();
      await onChanged();
      window.dispatchEvent(new CustomEvent("recurring-changed"));
      if (result.appliedCount > 0) {
        toast.success(
          `Applied ${result.appliedCount} recurring transaction${result.appliedCount === 1 ? "" : "s"}`
        );
      } else if (result.failedCount > 0) {
        setError(
          result.failures[0]?.message ??
            "Some recurring transactions could not be applied"
        );
      } else {
        toast.success("No recurring transactions are due");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to apply recurring transactions"
      );
    } finally {
      setApplying(false);
    }
  }

  /** Toggles the active/paused state of a recurring rule. */
  async function handleToggle(rule: RecurringTransaction) {
    setTogglingId(rule.id);
    setError(null);
    try {
      await api.setRecurringTransactionActive(rule.id, !rule.active);
      await onChanged();
      window.dispatchEvent(new CustomEvent("recurring-changed"));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update recurring transaction"
      );
    } finally {
      setTogglingId(null);
    }
  }

  /** Deletes the recurring rule that is pending confirmation. */
  async function handleConfirmDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      await api.deleteRecurringTransaction(id);
      await onChanged();
      window.dispatchEvent(new CustomEvent("recurring-changed"));
      toast.success(
        `Recurring rule "${pendingDeleteRule?.name ?? "rule"}" deleted`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete recurring transaction"
      );
    } finally {
      setDeletingId(null);
      setPendingDeleteRule(null);
    }
  }

  /** Updates a single form field by key. */
  function setField<K extends keyof ReturnType<typeof makeEmptyForm>>(
    key: K,
    value: ReturnType<typeof makeEmptyForm>[K]
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  const headerRight = (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
        {rules.length} saved
      </span>
      <button
        type="button"
        onClick={handleApplyDue}
        disabled={applying}
        style={{
          padding: "8px 12px",
          background: dueCount > 0 ? "#f59e0b" : "var(--surface-2)",
          color: dueCount > 0 ? "#000" : "var(--text-secondary)",
          border: dueCount > 0 ? "none" : "1px solid var(--border)",
          borderRadius: "8px",
          cursor: applying ? "not-allowed" : "pointer",
          opacity: applying ? 0.45 : 1,
          fontWeight: 700,
          fontSize: "12px",
        }}
      >
        {applying
          ? "Applying..."
          : dueCount > 0
          ? `Apply due (${dueCount})`
          : "Apply due"}
      </button>
    </div>
  );

  return (
    <>
      <AlertDialog
        open={pendingDeleteRule !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) setPendingDeleteRule(null);
        }}
      >
        <AlertDialogContent>
          <div style={{ padding: "12px 14px" }}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingDeleteRule?.name
                  ? `Delete recurring rule "${pendingDeleteRule.name}"?`
                  : "Delete recurring rule?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDeleteRule?.name
                  ? `This will remove "${pendingDeleteRule.name}" from the recurring schedule. Transactions already created from this rule will remain in the account history.`
                  : "This only removes the recurring schedule. Transactions already created from this rule will remain in the account history."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                onClick={() => setPendingDeleteRule(null)}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={() =>
                  pendingDeleteRule && handleConfirmDelete(pendingDeleteRule.id)
                }
                disabled={Boolean(deletingId)}
              >
                {deletingId ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <CollapsibleCard
        eyebrow="Recurring Transactions"
        title="Plan repeating income and bills"
        description="Create recurring deposits or withdrawals, then apply due entries whenever you want to bring the ledger up to date."
        headerRight={headerRight}
        className="fade-up fade-up-2"
        style={{}}
      >
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "12px",
            marginBottom: "16px",
          }}
        >
          Start date is the first scheduled occurrence. End date is optional and
          stops future runs after that date.
        </p>

        <form onSubmit={handleSave} style={{ marginBottom: "20px" }}>
          {editingRuleId && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                marginBottom: "12px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Editing:{" "}
                <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                  {form.name || "Untitled rule"}
                </span>
              </p>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Cancel edit
              </button>
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "grid", gap: "6px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-secondary)",
                }}
              >
                Rule name
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder='e.g. "Monthly rent" or "Main payroll"'
                aria-label="Recurring rule name"
                style={{
                  width: "100%",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                }}
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <select
              value={form.accountId}
              onChange={(e) => setField("accountId", e.target.value)}
              aria-label="Recurring account"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "var(--text-primary)",
              }}
            >
              <option value="">Choose account</option>
              {recurringAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname ?? account.ownerName}
                </option>
              ))}
            </select>
            <select
              value={form.type}
              onChange={(e) => {
                const nextType = e.target.value as RecurringTransactionType;
                setForm((previous) => ({
                  ...previous,
                  type: nextType,
                  category: nextType === "DEPOSIT" ? "Salary" : "Rent",
                  customCategory: "",
                }));
              }}
              aria-label="Recurring transaction type"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "var(--text-primary)",
              }}
            >
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="DEPOSIT">Deposit</option>
            </select>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="Amount"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "var(--text-primary)",
              }}
            />
            <select
              value={form.frequency}
              onChange={(e) =>
                setField("frequency", e.target.value as RecurringFrequency)
              }
              aria-label="Recurring frequency"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "var(--text-primary)",
              }}
            >
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Biweekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <select
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              aria-label="Recurring category"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "var(--text-primary)",
              }}
            >
              {recurringCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
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
                Start date
              </span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
                aria-label="Recurring start date"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                }}
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
                End date (optional)
              </span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setField("endDate", e.target.value)}
                aria-label="Recurring end date"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                }}
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
                Merchant
              </span>
              <input
                type="text"
                value={form.merchant}
                onChange={(e) => setField("merchant", e.target.value)}
                placeholder='e.g. "Hydro Quebec"'
                aria-label="Recurring merchant"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  color: "var(--text-primary)",
                }}
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 18px",
                background: "#f59e0b",
                color: "#000",
                fontWeight: 700,
                fontSize: "14px",
                border: "none",
                borderRadius: "8px",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.45 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : editingRuleId
                ? "Save changes"
                : "Save rule"}
            </button>
          </div>

          {form.category === "Custom..." && (
            <input
              type="text"
              value={form.customCategory}
              onChange={(e) => setField("customCategory", e.target.value)}
              placeholder="Custom category"
              style={{
                width: "100%",
                marginBottom: "10px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "var(--text-primary)",
              }}
            />
          )}

          <input
            type="text"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Description (optional)"
            style={{
              width: "100%",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          />
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px" }}>
            Changes affect future recurring runs only. Transactions already
            created from this rule stay unchanged.
          </p>

          {error && (
            <p
              className="num"
              style={{ color: "#f87171", fontSize: "12px", marginTop: "10px" }}
            >
              {error}
            </p>
          )}
        </form>

        {rules.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            No recurring rules yet. Add salary, rent, or subscriptions above.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "flex-start",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
                      {rule.name}
                    </p>
                    {rule.merchant && (
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                        Merchant: {rule.merchant}
                      </p>
                    )}
                    <p className="num" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {formatCurrency(rule.amount)} ·{" "}
                      {rule.frequency.toLowerCase()} ·{" "}
                      {rule.accountNickname ?? rule.accountOwnerName}
                    </p>
                    {(rule.category || rule.description) && (
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                        {[rule.category, rule.description]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "4px 8px",
                      borderRadius: "999px",
                      background: rule.active ? "#22c55e22" : "#6b728022",
                      color: rule.active ? "#22c55e" : "#9ca3af",
                    }}
                  >
                    {rule.active ? "Active" : "Paused"}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <p className="num" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Next run{" "}
                      {new Date(rule.nextRunAt).toLocaleDateString("en-CA", {
                        dateStyle: "medium",
                      })}
                    </p>
                    {rule.lastRunAt && (
                      <p className="num" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        Last applied{" "}
                        {new Date(rule.lastRunAt).toLocaleDateString("en-CA", {
                          dateStyle: "medium",
                        })}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => startEditing(rule)}
                      disabled={
                        Boolean(editingRuleId && editingRuleId !== rule.id) ||
                        togglingId === rule.id
                      }
                      style={{
                        padding: "8px 12px",
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--text-secondary)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        cursor:
                          Boolean(editingRuleId && editingRuleId !== rule.id) ||
                          togglingId === rule.id
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          Boolean(editingRuleId && editingRuleId !== rule.id) ||
                          togglingId === rule.id
                            ? 0.45
                            : 1,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(rule)}
                      disabled={togglingId === rule.id}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--text-secondary)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        cursor:
                          togglingId === rule.id ? "not-allowed" : "pointer",
                        opacity: togglingId === rule.id ? 0.45 : 1,
                      }}
                    >
                      {togglingId === rule.id
                        ? "Saving..."
                        : rule.active
                        ? "Pause"
                        : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteRule(rule)}
                      disabled={deletingId === rule.id}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #f8717130",
                        background: "transparent",
                        color: "#f87171",
                        borderRadius: "8px",
                        fontSize: "12px",
                        cursor:
                          deletingId === rule.id ? "not-allowed" : "pointer",
                        opacity: deletingId === rule.id ? 0.45 : 1,
                      }}
                    >
                      {deletingId === rule.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleCard>
    </>
  );
}
