"use client";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api, Account, AccountType, Budget, DateRangeQuery, MonthlyTrend, MonthlySummary, Profile, RecurringFrequency, RecurringTransaction, RecurringTransactionType } from "@/lib/api";
import { DateRangeControls } from "@/components/date-range-controls";
import { useDashboardView } from "@/components/dashboard-view-provider";
import { ProfileFormPanel } from "@/components/profile-form-panel";
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
import { buildDateRangeQuery, DateRangeState, formatLocalDate, getBrowserTimeZone, getPresetDateRange } from "@/lib/date-range";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend,
} from "recharts";

const EXPENSE_BUDGET_CATEGORIES = ["Groceries", "Rent", "Utilities", "Transport", "Dining", "Shopping", "Healthcare", "Entertainment", "Other", "Custom..."];

const ACCOUNT_TYPE_META: Record<AccountType, { label: string; color: string; soft: string; border: string }> = {
  CHEQUING: { label: "Chequing", color: "#f59e0b", soft: "#f59e0b22", border: "#f59e0b44" },
  SAVINGS: { label: "Savings", color: "#22c55e", soft: "#16a34a22", border: "#16a34a44" },
  TFSA: { label: "TFSA", color: "#38bdf8", soft: "#0ea5e922", border: "#0ea5e944" },
  RRSP: { label: "RRSP", color: "#a78bfa", soft: "#8b5cf622", border: "#8b5cf644" },
  FHSA: { label: "FHSA", color: "#fb7185", soft: "#f43f5e22", border: "#f43f5e44" },
  CREDIT: { label: "Credit", color: "#ef4444", soft: "#ef444422", border: "#ef444444" },
};

const ACCOUNT_GROUPS = [
  { id: "cash", title: "Cash Accounts", description: "Daily banking and savings balances.", types: ["CHEQUING", "SAVINGS"] as AccountType[] },
  { id: "registered", title: "Registered Accounts", description: "Tax-advantaged savings and investment accounts.", types: ["TFSA", "RRSP", "FHSA"] as AccountType[] },
  { id: "credit", title: "Credit Accounts", description: "Debt balances tracked separately from cash.", types: ["CREDIT"] as AccountType[] },
];

function Home() {
  const { view } = useDashboardView();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [previousMonthlySummary, setPreviousMonthlySummary] = useState<MonthlySummary | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [snapshotView, setSnapshotView] = useState<"snapshot" | "trends">("snapshot");
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [nickname, setNickname] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>("CHEQUING");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetCategory, setBudgetCategory] = useState("Groceries");
  const [customBudgetCategory, setCustomBudgetCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [recurringRules, setRecurringRules] = useState<RecurringTransaction[]>([]);
  const [recurringAccountId, setRecurringAccountId] = useState("");
  const [recurringName, setRecurringName] = useState("");
  const [recurringType, setRecurringType] = useState<RecurringTransactionType>("WITHDRAWAL");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringCategory, setRecurringCategory] = useState("Rent");
  const [recurringCustomCategory, setRecurringCustomCategory] = useState("");
  const [recurringMerchant, setRecurringMerchant] = useState("");
  const [recurringDescription, setRecurringDescription] = useState("");
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>("MONTHLY");
  const [recurringStartDate, setRecurringStartDate] = useState(() => formatLocalDate(new Date()));
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [editingRecurringRuleId, setEditingRecurringRuleId] = useState<string | null>(null);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringApplying, setRecurringApplying] = useState(false);
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [togglingRecurringId, setTogglingRecurringId] = useState<string | null>(null);
  const [deletingRecurringId, setDeletingRecurringId] = useState<string | null>(null);
  const [pendingDeleteRecurringRule, setPendingDeleteRecurringRule] = useState<RecurringTransaction | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeState>(() => getPresetDateRange("this-month"));
  const [timeZone, setTimeZone] = useState("UTC");
  const searchParams = useSearchParams();
  const router = useRouter();

  const rangeQuery: DateRangeQuery | undefined = useMemo(() => {
    return buildDateRangeQuery(dateRange);
  }, [dateRange]);

  useEffect(() => {
    if (dateRange.preset !== "custom") {
      setDateRange(getPresetDateRange(dateRange.preset));
    }
  }, [dateRange.preset]);

  useEffect(() => {
    setTimeZone(getBrowserTimeZone());
  }, []);

  useEffect(() => {
    const deleted = searchParams.get("deleted");
    if (deleted) {
      toast.success(`${deleted} deleted`);
      router.replace("/");
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      let previousRangeQuery: DateRangeQuery | undefined;
      if (rangeQuery) {
        const start = new Date(rangeQuery.start);
        const end = new Date(rangeQuery.end);
        const diffMs = end.getTime() - start.getTime();
        previousRangeQuery = {
          start: new Date(start.getTime() - diffMs).toISOString(),
          end: start.toISOString(),
        };
      }
      const [nextAccounts, nextSummary, nextPreviousSummary, nextBudgets, nextRecurringRules, nextTrends] = await Promise.all([
        api.listAccounts(),
        api.getMonthlySummary(rangeQuery),
        previousRangeQuery ? api.getMonthlySummary(previousRangeQuery) : Promise.resolve(null),
        api.getBudgets(rangeQuery),
        api.listRecurringTransactions(),
        api.getMonthlyTrends(6),
      ]);
      setAccounts(nextAccounts);
      setMonthlySummary(nextSummary);
      setPreviousMonthlySummary(nextPreviousSummary);
      setBudgets(nextBudgets);
      setRecurringRules(nextRecurringRules);
      setMonthlyTrends(nextTrends);
    } finally {
      setLoading(false);
    }
  }, [rangeQuery]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  useEffect(() => {
    const nextRecurringAccounts = accounts.filter((account) => account.accountType !== "CREDIT");
    if (!recurringAccountId && nextRecurringAccounts.length > 0) {
      setRecurringAccountId(nextRecurringAccounts[0].id);
    }
  }, [accounts, recurringAccountId]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const nextProfile = await api.getProfile();
        if (!cancelled) {
          setProfile(nextProfile);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profileLoading && !profile) {
    return (
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px" }}>
        <div className="fade-up" style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f59e0b", marginBottom: "10px" }}>
            Welcome To Bloom
          </p>
          <h1 style={{ fontSize: "34px", fontWeight: 800, letterSpacing: "-0.6px", marginBottom: "8px" }}>
            Let&apos;s set up your account.
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px", maxWidth: "560px" }}>
            We need a few profile details before you start using Bloom. Your first and last name are prefilled from Google when available.
          </p>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          <div
            className="fade-up fade-up-1"
            style={{
              background: "linear-gradient(135deg, #18120a 0%, #111111 65%)",
              border: "1px solid #2a2112",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f59e0b", marginBottom: "12px" }}>
              Step 1
            </p>
            <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.4px", marginBottom: "8px" }}>
              Choose how your profile appears in Bloom
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "520px" }}>
              Set your name, username, and email. Once this is saved, the dashboard and sidebar will use your Bloom profile instead of the raw Google session name.
            </p>
          </div>

          <ProfileFormPanel
            title="Create your profile"
            description="This is the first step of onboarding. You can update these details later from the profile page."
            submitLabel="Continue to Bloom"
            successMessage="Profile saved. Loading your dashboard..."
            onSaved={(savedProfile) => setProfile(savedProfile)}
          />
        </div>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.createAccount(ownerName.trim(), accountType, nickname.trim() || undefined);
      setOwnerName("");
      setNickname("");
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    setBudgetError(null);
    const monthlyLimit = parseFloat(budgetAmount);
    const category = budgetCategory === "Custom..." ? customBudgetCategory.trim() : budgetCategory;

    if (!category) {
      setBudgetError("Choose a category");
      return;
    }
    if (Number.isNaN(monthlyLimit) || monthlyLimit <= 0) {
      setBudgetError("Enter a valid monthly limit");
      return;
    }

    setBudgetSaving(true);
    try {
      await api.saveBudget(category, monthlyLimit);
      setBudgetAmount("");
      setCustomBudgetCategory("");
      setBudgetCategory("Groceries");
      await loadAccounts();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : "Failed to save budget");
    } finally {
      setBudgetSaving(false);
    }
  }

  async function handleDeleteBudget(id: string) {
    setDeletingBudgetId(id);
    setBudgetError(null);
    try {
      await api.deleteBudget(id);
      await loadAccounts();
    } catch (err) {
      setBudgetError(err instanceof Error ? err.message : "Failed to delete budget");
    } finally {
      setDeletingBudgetId(null);
    }
  }

  function resetRecurringForm() {
    setEditingRecurringRuleId(null);
    setRecurringName("");
    setRecurringAmount("");
    setRecurringDescription("");
    setRecurringMerchant("");
    setRecurringEndDate("");
    setRecurringType("WITHDRAWAL");
    setRecurringFrequency("MONTHLY");
    setRecurringCategory("Rent");
    setRecurringCustomCategory("");
    setRecurringStartDate(formatLocalDate(new Date()));
  }

  function startEditingRecurringRule(rule: RecurringTransaction) {
    setRecurringError(null);
    setEditingRecurringRuleId(rule.id);
    setRecurringAccountId(rule.accountId);
    setRecurringName(rule.name);
    setRecurringType(rule.type);
    setRecurringAmount(rule.amount.toString());
    setRecurringFrequency(rule.frequency);
    setRecurringMerchant(rule.merchant ?? "");
    setRecurringDescription(rule.description ?? "");
    setRecurringStartDate(rule.startDate.slice(0, 10));
    setRecurringEndDate(rule.endDate?.slice(0, 10) ?? "");

    const supportedCategories = rule.type === "DEPOSIT"
      ? ["Salary", "Freelance", "Gift", "Investment", "Other Income"]
      : ["Rent", "Utilities", "Transport", "Dining", "Healthcare", "Entertainment", "Other"];

    if (rule.category && supportedCategories.includes(rule.category)) {
      setRecurringCategory(rule.category);
      setRecurringCustomCategory("");
    } else if (rule.category) {
      setRecurringCategory("Custom...");
      setRecurringCustomCategory(rule.category);
    } else {
      setRecurringCategory(rule.type === "DEPOSIT" ? "Salary" : "Rent");
      setRecurringCustomCategory("");
    }
  }

  async function handleSaveRecurringTransaction(e: React.FormEvent) {
    e.preventDefault();
    setRecurringError(null);
    const amount = parseFloat(recurringAmount);
    const category = recurringCategory === "Custom..." ? recurringCustomCategory.trim() : recurringCategory;

    if (!recurringAccountId) {
      setRecurringError("Choose an account");
      return;
    }
    if (!recurringName.trim()) {
      setRecurringError("Enter a rule name");
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      setRecurringError("Enter a valid recurring amount");
      return;
    }
    if (!recurringStartDate) {
      setRecurringError("Choose a start date");
      return;
    }

    setRecurringSaving(true);
    try {
      const payload = {
        accountId: recurringAccountId,
        name: recurringName.trim(),
        type: recurringType,
        amount,
        category: category || undefined,
        merchant: recurringMerchant.trim() || undefined,
        description: recurringDescription.trim() || undefined,
        frequency: recurringFrequency,
        startDate: new Date(`${recurringStartDate}T12:00:00`).toISOString(),
        endDate: recurringEndDate ? new Date(`${recurringEndDate}T12:00:00`).toISOString() : undefined,
      };

      if (editingRecurringRuleId) {
        await api.updateRecurringTransaction(editingRecurringRuleId, payload);
        toast.success("Recurring rule updated");
      } else {
        await api.createRecurringTransaction(payload);
        toast.success("Recurring rule created");
      }

      resetRecurringForm();
      await loadAccounts();
    } catch (err) {
      setRecurringError(err instanceof Error ? err.message : "Failed to save recurring transaction");
    } finally {
      setRecurringSaving(false);
    }
  }

  async function handleApplyDueRecurringTransactions() {
    setRecurringApplying(true);
    setRecurringError(null);
    try {
      const result = await api.applyDueRecurringTransactions();
      await loadAccounts();
      if (result.appliedCount > 0) {
        toast.success(`Applied ${result.appliedCount} recurring transaction${result.appliedCount === 1 ? "" : "s"}`);
      } else if (result.failedCount > 0) {
        setRecurringError(result.failures[0]?.message ?? "Some recurring transactions could not be applied");
      } else {
        toast.success("No recurring transactions are due");
      }
    } catch (err) {
      setRecurringError(err instanceof Error ? err.message : "Failed to apply recurring transactions");
    } finally {
      setRecurringApplying(false);
    }
  }

  async function handleToggleRecurringTransaction(rule: RecurringTransaction) {
    setTogglingRecurringId(rule.id);
    setRecurringError(null);
    try {
      await api.setRecurringTransactionActive(rule.id, !rule.active);
      await loadAccounts();
    } catch (err) {
      setRecurringError(err instanceof Error ? err.message : "Failed to update recurring transaction");
    } finally {
      setTogglingRecurringId(null);
    }
  }

  async function handleDeleteRecurringTransaction(id: string) {
    setDeletingRecurringId(id);
    setRecurringError(null);
    try {
      await api.deleteRecurringTransaction(id);
      await loadAccounts();
      const deletedRuleName = pendingDeleteRecurringRule?.name ?? "Recurring rule";
      toast.success(`Recurring transaction "${deletedRuleName}" deleted`);
    } catch (err) {
      setRecurringError(err instanceof Error ? err.message : "Failed to delete recurring transaction");
    } finally {
      setDeletingRecurringId(null);
      setPendingDeleteRecurringRule(null);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);
  const recurringAccounts = accounts.filter((account) => account.accountType !== "CREDIT");
  const recurringCategories = recurringType === "DEPOSIT"
    ? ["Salary", "Freelance", "Gift", "Investment", "Other Income", "Custom..."]
    : ["Rent", "Utilities", "Transport", "Dining", "Healthcare", "Entertainment", "Other", "Custom..."];
  const dueRecurringCount = recurringRules.filter((rule) => rule.active && new Date(rule.nextRunAt) <= new Date()).length;

  const cashAccounts = accounts.filter((account) => account.accountType !== "CREDIT");
  const creditAccounts = accounts.filter((account) => account.accountType === "CREDIT");
  const chequingAccounts = accounts.filter((account) => account.accountType === "CHEQUING");
  const savingsAccounts = accounts.filter((account) => account.accountType === "SAVINGS");
  const registeredAccounts = accounts.filter((account) =>
    account.accountType === "TFSA" || account.accountType === "RRSP" || account.accountType === "FHSA"
  );
  const totalCash = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalCredit = creditAccounts.reduce((sum, a) => sum + a.balance, 0);
  const netWorth = totalCash - totalCredit;
  const chequingCount = chequingAccounts.length;
  const savingsCount = savingsAccounts.length;
  const registeredCount = registeredAccounts.length;
  const creditCount = creditAccounts.length;
  const expenseCategories = monthlySummary?.categories.filter(category => category.spending > 0) ?? [];
  const incomeDelta = monthlySummary && previousMonthlySummary ? monthlySummary.income - previousMonthlySummary.income : null;
  const spendingDelta = monthlySummary && previousMonthlySummary ? monthlySummary.spending - previousMonthlySummary.spending : null;
  const netDelta = monthlySummary && previousMonthlySummary ? monthlySummary.netCashFlow - previousMonthlySummary.netCashFlow : null;
  const knownBudgetCategories = Array.from(new Set([
    ...EXPENSE_BUDGET_CATEGORIES.filter((category) => category !== "Custom..."),
    ...expenseCategories.map((category) => category.category),
    ...budgets.map((budget) => budget.category),
  ])).sort((left, right) => left.localeCompare(right));
  const dashboardColumns = view === "single" ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))";
  const groupedAccounts = ACCOUNT_GROUPS.map((group) => ({
    ...group,
    accounts: accounts.filter((account) => group.types.includes(account.accountType)),
  })).filter((group) => group.accounts.length > 0);
  const accountBalanceChartData = accounts.map((account) => ({
    id: account.id,
    name: (account.nickname ?? account.ownerName).split(" ")[0],
    balance: account.balance,
    type: account.accountType,
  }));

  function renderAccountCard(acc: Account, index: number) {
    return (
      <Link
        key={acc.id}
        href={`/account/${acc.id}`}
        className="fade-up"
        style={{
          animationDelay: `${0.04 * index}s`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          textDecoration: 'none',
          color: 'inherit',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)';
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-1)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: ACCOUNT_TYPE_META[acc.accountType].soft,
            border: `1px solid ${ACCOUNT_TYPE_META[acc.accountType].border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', fontWeight: 700,
            color: ACCOUNT_TYPE_META[acc.accountType].color,
          }}>
            {(acc.nickname ?? acc.ownerName)[0].toUpperCase()}
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: acc.nickname ? '1px' : '3px' }}>{acc.nickname ?? acc.ownerName}</p>
            {acc.nickname && (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>{acc.ownerName}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '2px 6px', borderRadius: '4px',
                background: ACCOUNT_TYPE_META[acc.accountType].soft,
                color: ACCOUNT_TYPE_META[acc.accountType].color,
              }}>
                {ACCOUNT_TYPE_META[acc.accountType].label}
              </span>
              {acc.frozen && (
                <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', borderRadius: '4px', background: '#3b82f622', color: '#60a5fa' }}>
                  FROZEN
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="num" style={{ fontSize: '15px', fontWeight: 500, color: ACCOUNT_TYPE_META[acc.accountType].color }}>{fmt(acc.balance)}</span>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    );
  }

  function renderSummaryCard({
    title,
    value,
    color,
    targetAccount,
  }: {
    title: string;
    value: React.ReactNode;
    color?: string;
    targetAccount?: Account;
  }) {
    const clickable = Boolean(targetAccount);

    return (
      <button
        type="button"
        onClick={() => {
          if (targetAccount) {
            router.push(`/account/${targetAccount.id}`);
          }
        }}
        disabled={!clickable}
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'left',
          cursor: clickable ? 'pointer' : 'default',
          opacity: clickable ? 1 : 0.9,
          transition: 'border-color 0.15s, transform 0.15s',
        }}
        onMouseEnter={(e) => {
          if (clickable) {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          {title}
        </p>
        <div className="num" style={{ fontSize: '22px', fontWeight: 500, color: color ?? 'var(--text-primary)' }}>
          {value}
        </div>
      </button>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px 48px' }}>
      <AlertDialog
        open={pendingDeleteRecurringRule !== null}
        onOpenChange={(open) => {
          if (!open && !deletingRecurringId) {
            setPendingDeleteRecurringRule(null);
          }
        }}
      >
        <AlertDialogContent>
            <div style={{ padding: "12px 14px" }}>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pendingDeleteRecurringRule?.name
                    ? `Delete recurring rule "${pendingDeleteRecurringRule.name}"?`
                    : "Delete recurring rule?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingDeleteRecurringRule?.name
                    ? `This will remove "${pendingDeleteRecurringRule.name}" from the recurring schedule. Transactions already created from this rule will remain in the account history.`
                    : "This only removes the recurring schedule. Transactions already created from this rule will remain in the account history."}
                </AlertDialogDescription>
              </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                onClick={() => setPendingDeleteRecurringRule(null)}
                disabled={Boolean(deletingRecurringId)}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={() => pendingDeleteRecurringRule && handleDeleteRecurringTransaction(pendingDeleteRecurringRule.id)}
                disabled={Boolean(deletingRecurringId)}
              >
                {deletingRecurringId ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Welcome */}
      <div className="fade-up" style={{ marginBottom: '28px' }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
              {profile?.firstName ? `Good morning, ${profile.firstName}.` : "Good morning."}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
              Here's your financial overview.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '6px' }}>
              Times shown in {timeZone}.
            </p>
          </div>
          <DateRangeControls value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Stats row */}
      {accounts.length > 0 && (
        <div className="fade-up fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '36px' }}>
          {renderSummaryCard({
            title: "Net Worth",
            value: fmt(netWorth),
            color: netWorth >= 0 ? "#22c55e" : "#ef4444",
          })}
          {renderSummaryCard({
            title: "Total Cash",
            value: fmt(totalCash),
            color: "#f59e0b",
            targetAccount: cashAccounts[0],
          })}
          {renderSummaryCard({
            title: "Chequing",
            value: <>{chequingCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>acct{chequingCount !== 1 ? 's' : ''}</span></>,
            targetAccount: chequingAccounts[0],
          })}
          {renderSummaryCard({
            title: "Savings",
            value: <>{savingsCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>acct{savingsCount !== 1 ? 's' : ''}</span></>,
            targetAccount: savingsAccounts[0],
          })}
          {renderSummaryCard({
            title: "Registered",
            value: <>{registeredCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>acct{registeredCount !== 1 ? 's' : ''}</span></>,
            targetAccount: registeredAccounts[0],
          })}
          {renderSummaryCard({
            title: "Credit",
            value: creditCount > 0
              ? <>{fmt(totalCredit)} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>owed</span></>
              : <>{creditCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>acct{creditCount !== 1 ? 's' : ''}</span></>,
            color: creditCount > 0 ? '#ef4444' : undefined,
            targetAccount: creditAccounts[0],
          })}
        </div>
      )}

      {accounts.length > 0 && monthlySummary && (
        <div style={{ display: 'grid', gridTemplateColumns: dashboardColumns, gap: '20px', alignItems: 'start', marginBottom: '32px' }}>
          {/* Monthly spending summary */}
        <div className="fade-up fade-up-1" style={{
          background: 'linear-gradient(135deg, #17120a 0%, var(--surface-1) 58%)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '24px',
          minHeight: '100%',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Monthly Snapshot
              </p>
              <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                {snapshotView === "snapshot" ? "Cash flow by category" : "Last 6 months"}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {snapshotView === "snapshot" && monthlySummary.topExpenseCategory && (
                <div style={{ textAlign: 'right', marginRight: '8px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '5px' }}>Top Spend</p>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>{monthlySummary.topExpenseCategory}</p>
                </div>
              )}
              {(["snapshot", "trends"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSnapshotView(v)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: snapshotView === v ? '1px solid #f59e0b66' : '1px solid var(--border)',
                    background: snapshotView === v ? '#f59e0b1a' : 'var(--surface-2)',
                    color: snapshotView === v ? '#f59e0b' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {v === "snapshot" ? "Snapshot" : "Trends"}
                </button>
              ))}
            </div>
          </div>

          {snapshotView === "snapshot" ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: expenseCategories.length ? '22px' : '0' }}>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Income</p>
                  <p className="num" style={{ fontSize: '18px', fontWeight: 600, color: '#22c55e' }}>{fmt(monthlySummary.income)}</p>
                  {incomeDelta !== null && incomeDelta !== 0 && (
                    <p className="num" style={{ fontSize: '11px', marginTop: '5px', color: incomeDelta > 0 ? '#22c55e' : '#f97316' }}>
                      {incomeDelta > 0 ? '+' : ''}{fmt(incomeDelta)} vs prior
                    </p>
                  )}
                </div>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Spending</p>
                  <p className="num" style={{ fontSize: '18px', fontWeight: 600, color: '#f97316' }}>{fmt(monthlySummary.spending)}</p>
                  {spendingDelta !== null && spendingDelta !== 0 && (
                    <p className="num" style={{ fontSize: '11px', marginTop: '5px', color: spendingDelta < 0 ? '#22c55e' : '#f97316' }}>
                      {spendingDelta > 0 ? '+' : ''}{fmt(spendingDelta)} vs prior
                    </p>
                  )}
                </div>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Net</p>
                  <p className="num" style={{ fontSize: '18px', fontWeight: 600, color: monthlySummary.netCashFlow >= 0 ? '#22c55e' : '#f97316' }}>{fmt(monthlySummary.netCashFlow)}</p>
                  {netDelta !== null && netDelta !== 0 && (
                    <p className="num" style={{ fontSize: '11px', marginTop: '5px', color: netDelta > 0 ? '#22c55e' : '#f97316' }}>
                      {netDelta > 0 ? '+' : ''}{fmt(netDelta)} vs prior
                    </p>
                  )}
                </div>
              </div>
              {expenseCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={expenseCategories} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={48} />
                    <Tooltip
                      formatter={(value) => fmt(Number(value))}
                      contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px', color: '#f3f4f6' }}
                      labelStyle={{ color: '#f59e0b' }}
                      itemStyle={{ color: '#f3f4f6' }}
                      cursor={{ fill: '#ffffff06' }}
                    />
                    <Bar dataKey="spending" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  No spending has been categorized this month yet.
                </p>
              )}
            </>
          ) : monthlyTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyTrends} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={56} />
                <Tooltip
                  formatter={(value, name) => [fmt(Number(value)), name === "income" ? "Income" : name === "spending" ? "Spending" : "Net"]}
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px', color: '#f3f4f6' }}
                  labelStyle={{ color: '#9ca3af' }}
                  cursor={{ fill: '#ffffff06' }}
                />
                <Legend formatter={(value) => value === "income" ? "Income" : value === "spending" ? "Spending" : "Net"} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="spending" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No transaction history yet.</p>
          )}
        </div>

          {/* Budgets */}
        <div className="fade-up fade-up-2" style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '24px',
          minHeight: '100%',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Budgets
              </p>
              <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: '6px' }}>
                Set monthly limits by category
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '460px' }}>
                Budgets compare this month&apos;s withdrawal totals against your category limits.
              </p>
            </div>
            <span className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{budgets.length} saved</span>
          </div>

          <form onSubmit={handleSaveBudget} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 150px) auto', gap: '10px', alignItems: 'stretch' }}>
              <select
                value={budgetCategory}
                onChange={(e) => setBudgetCategory(e.target.value)}
                aria-label="Budget category"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              >
                {knownBudgetCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
                <option value="Custom...">Custom...</option>
              </select>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="Monthly limit"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={budgetSaving}
                style={{
                  padding: '10px 18px',
                  background: '#f59e0b',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: budgetSaving ? 'not-allowed' : 'pointer',
                  opacity: budgetSaving ? 0.45 : 1,
                }}
              >
                {budgetSaving ? "Saving..." : "Save Budget"}
              </button>
            </div>

            {budgetCategory === "Custom..." && (
              <input
                type="text"
                value={customBudgetCategory}
                onChange={(e) => setCustomBudgetCategory(e.target.value)}
                placeholder="Custom category"
                style={{
                  marginTop: '10px',
                  width: '100%',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            )}

            {budgetError && (
              <p className="num" style={{ color: '#f87171', fontSize: '12px', marginTop: '10px' }}>{budgetError}</p>
            )}
          </form>

          {budgets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              No budgets yet. Add one above to start tracking category limits.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {budgets.map((budget) => {
                const progress = Math.min(budget.percentageUsed, 100);

                return (
                  <div key={budget.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                      <Link
                        href={`/budgets/${budget.id}`}
                        style={{ minWidth: 0, flex: 1, textDecoration: 'none', color: 'inherit' }}
                      >
                        <p style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>{budget.category}</p>
                        <p className="num" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {fmt(budget.currentSpending)} spent of {fmt(budget.monthlyLimit)}
                        </p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteBudget(budget.id)}
                        disabled={deletingBudgetId === budget.id}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '12px',
                          cursor: deletingBudgetId === budget.id ? 'not-allowed' : 'pointer',
                          opacity: deletingBudgetId === budget.id ? 0.45 : 1,
                        }}
                      >
                        {deletingBudgetId === budget.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>

                    <Link
                      href={`/budgets/${budget.id}`}
                      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                    >
                    <div style={{ height: '10px', borderRadius: '999px', background: '#ffffff0a', overflow: 'hidden', marginBottom: '10px' }}>
                      <div
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          background: budget.isOverBudget ? '#ef4444' : '#f59e0b',
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px' }}>
                      <span className="num" style={{ color: budget.isOverBudget ? '#f87171' : 'var(--text-secondary)' }}>
                        {budget.isOverBudget ? `${fmt(Math.abs(budget.remaining))} over budget` : `${fmt(budget.remaining)} remaining`}
                      </span>
                      <span className="num" style={{ color: 'var(--text-muted)' }}>
                        {budget.percentageUsed.toFixed(0)}% used
                      </span>
                    </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: dashboardColumns, gap: '20px', alignItems: 'start', marginBottom: '32px' }}>
          <div className="fade-up fade-up-2" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', minHeight: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Recurring Transactions
                </p>
                <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px', marginBottom: '6px' }}>
                  Plan repeating income and bills
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '460px' }}>
                  Create recurring deposits or withdrawals, then apply due entries whenever you want to bring the ledger up to date.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px', maxWidth: '520px' }}>
                  Start date is the first scheduled occurrence. End date is optional and stops future runs after that date.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="num" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{recurringRules.length} saved</p>
                <button
                  type="button"
                  onClick={handleApplyDueRecurringTransactions}
                  disabled={recurringApplying}
                  style={{
                    padding: '10px 14px',
                    background: dueRecurringCount > 0 ? '#f59e0b' : 'var(--surface-2)',
                    color: dueRecurringCount > 0 ? '#000' : 'var(--text-secondary)',
                    border: dueRecurringCount > 0 ? 'none' : '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: recurringApplying ? 'not-allowed' : 'pointer',
                    opacity: recurringApplying ? 0.45 : 1,
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  {recurringApplying ? "Applying..." : dueRecurringCount > 0 ? `Apply due (${dueRecurringCount})` : "Apply due"}
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveRecurringTransaction} style={{ marginBottom: '20px' }}>
              {editingRecurringRuleId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '12px', padding: '12px 14px', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Editing recurring rule: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{recurringName || "Untitled rule"}</span>
                  </p>
                  <button
                    type="button"
                    onClick={resetRecurringForm}
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Cancel edit
                  </button>
                </div>
              )}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                    Rule name
                  </span>
                  <input
                    type="text"
                    value={recurringName}
                    onChange={(e) => setRecurringName(e.target.value)}
                    placeholder='e.g. "Monthly rent" or "Main payroll"'
                    aria-label="Recurring rule name"
                    style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Use a short, recognizable name so it is easy to identify this rule later.
                  </span>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <select
                  value={recurringAccountId}
                  onChange={(e) => setRecurringAccountId(e.target.value)}
                  aria-label="Recurring account"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                >
                  <option value="">Choose account</option>
                  {recurringAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.nickname ?? account.ownerName}
                    </option>
                  ))}
                </select>
                <select
                  value={recurringType}
                  onChange={(e) => {
                    const nextType = e.target.value as RecurringTransactionType;
                    setRecurringType(nextType);
                    setRecurringCategory(nextType === "DEPOSIT" ? "Salary" : "Rent");
                    setRecurringCustomCategory("");
                  }}
                  aria-label="Recurring transaction type"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                >
                  <option value="WITHDRAWAL">Withdrawal</option>
                  <option value="DEPOSIT">Deposit</option>
                </select>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={recurringAmount}
                  onChange={(e) => setRecurringAmount(e.target.value)}
                  placeholder="Amount"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                />
                <select
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value as RecurringFrequency)}
                  aria-label="Recurring frequency"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <select
                  value={recurringCategory}
                  onChange={(e) => setRecurringCategory(e.target.value)}
                  aria-label="Recurring category"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                >
                  {recurringCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                    Start date
                  </span>
                  <input
                    type="date"
                    value={recurringStartDate}
                    onChange={(e) => setRecurringStartDate(e.target.value)}
                    aria-label="Recurring start date"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                    End date (optional)
                  </span>
                  <input
                    type="date"
                    value={recurringEndDate}
                    onChange={(e) => setRecurringEndDate(e.target.value)}
                    aria-label="Recurring end date"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                    Merchant
                  </span>
                  <input
                    type="text"
                    value={recurringMerchant}
                    onChange={(e) => setRecurringMerchant(e.target.value)}
                    placeholder='e.g. "Hydro Quebec" or "Acme Payroll"'
                    aria-label="Recurring merchant"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={recurringSaving}
                  style={{ padding: '10px 18px', background: '#f59e0b', color: '#000', fontWeight: 700, fontSize: '14px', border: 'none', borderRadius: '8px', cursor: recurringSaving ? 'not-allowed' : 'pointer', opacity: recurringSaving ? 0.45 : 1 }}
                >
                  {recurringSaving ? "Saving..." : editingRecurringRuleId ? "Save changes" : "Save rule"}
                </button>
              </div>
              {recurringCategory === "Custom..." && (
                <input
                  type="text"
                  value={recurringCustomCategory}
                  onChange={(e) => setRecurringCustomCategory(e.target.value)}
                  placeholder="Custom category"
                  style={{ width: '100%', marginBottom: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
                />
              )}
              <input
                type="text"
                value={recurringDescription}
                onChange={(e) => setRecurringDescription(e.target.value)}
                placeholder="Description (optional)"
                style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: 'var(--text-primary)' }}
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                Changes affect future recurring runs only. Transactions already created from this rule stay unchanged.
              </p>
              {recurringError && (
                <p className="num" style={{ color: '#f87171', fontSize: '12px', marginTop: '10px' }}>{recurringError}</p>
              )}
            </form>

            {recurringRules.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                No recurring rules yet. Add salary, rent, or subscriptions above.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recurringRules.map((rule) => (
                  <div key={rule.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                          {rule.name}
                          </p>
                          {rule.merchant && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              Merchant: {rule.merchant}
                            </p>
                          )}
                          <p className="num" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {fmt(rule.amount)} · {rule.frequency.toLowerCase()} · {rule.accountNickname ?? rule.accountOwnerName}
                          </p>
                          {(rule.category || rule.merchant || rule.description) && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {[rule.category, rule.description].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        padding: '4px 8px',
                        borderRadius: '999px',
                        background: rule.active ? '#22c55e22' : '#6b728022',
                        color: rule.active ? '#22c55e' : '#9ca3af',
                      }}>
                        {rule.active ? "Active" : "Paused"}
                      </span>
                    </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <p className="num" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Next run {new Date(rule.nextRunAt).toLocaleDateString("en-CA", { dateStyle: "medium" })}
                          </p>
                          {rule.lastRunAt && (
                            <p className="num" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Last applied {new Date(rule.lastRunAt).toLocaleDateString("en-CA", { dateStyle: "medium" })}
                            </p>
                          )}
                        </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => startEditingRecurringRule(rule)}
                          disabled={Boolean(editingRecurringRuleId && editingRecurringRuleId !== rule.id) || togglingRecurringId === rule.id}
                          style={{ padding: '8px 12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '12px', cursor: Boolean(editingRecurringRuleId && editingRecurringRuleId !== rule.id) || togglingRecurringId === rule.id ? 'not-allowed' : 'pointer', opacity: Boolean(editingRecurringRuleId && editingRecurringRuleId !== rule.id) || togglingRecurringId === rule.id ? 0.45 : 1 }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleRecurringTransaction(rule)}
                          disabled={togglingRecurringId === rule.id}
                          style={{ padding: '8px 12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '12px', cursor: togglingRecurringId === rule.id ? 'not-allowed' : 'pointer', opacity: togglingRecurringId === rule.id ? 0.45 : 1 }}
                        >
                          {togglingRecurringId === rule.id ? "Saving..." : rule.active ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteRecurringRule(rule)}
                          disabled={deletingRecurringId === rule.id}
                          style={{ padding: '8px 12px', border: '1px solid #f8717130', background: 'transparent', color: '#f87171', borderRadius: '8px', fontSize: '12px', cursor: deletingRecurringId === rule.id ? 'not-allowed' : 'pointer', opacity: deletingRecurringId === rule.id ? 0.45 : 1 }}
                        >
                          {deletingRecurringId === rule.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: dashboardColumns, gap: '20px', alignItems: 'start', marginBottom: '32px' }}>
      {/* Balance bar chart */}
      {accounts.length > 1 && (
        <div className="fade-up fade-up-1" style={{
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: '14px', padding: '24px', minHeight: '100%',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Account Balances
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={accountBalanceChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={48} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px', color: '#f3f4f6' }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#f3f4f6' }}
                cursor={{ fill: '#ffffff06' }}
              />
              <Bar
                dataKey="balance"
                radius={[4, 4, 0, 0]}
                onClick={(data) => {
                  if (data?.id) {
                    router.push(`/account/${data.id}`);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {accountBalanceChartData.map((account, i) => (
                  <Cell key={i} fill={ACCOUNT_TYPE_META[account.type].color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Open account */}
      <div className="fade-up fade-up-2" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', minHeight: '100%' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>Open New Account</p>
        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px', marginBottom: '12px', alignItems: 'stretch' }}>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Account nickname"
              style={{
                flex: 1,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = '#f59e0b')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Account holder name"
              style={{
                flex: 1,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = '#f59e0b')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '140px auto', gap: '10px' }}>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                aria-label="Account type"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  textAlign: 'center',
                  textAlignLast: 'center',
                }}
                onFocus={e => (e.target.style.borderColor = '#f59e0b')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              >
                <option value="CHEQUING">Chequing</option>
                <option value="SAVINGS">Savings</option>
                <option value="TFSA">TFSA</option>
                <option value="RRSP">RRSP</option>
                <option value="FHSA">FHSA</option>
                <option value="CREDIT">Credit card</option>
              </select>
              <button
                type="submit"
                disabled={creating || !ownerName.trim()}
                style={{
                  padding: '10px 20px',
                  background: '#f59e0b',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: creating || !ownerName.trim() ? 'not-allowed' : 'pointer',
                  opacity: creating || !ownerName.trim() ? 0.45 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {creating ? "Opening..." : "Open"}
              </button>
            </div>
          </div>
          {error && <p className="num" style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>{error}</p>}
        </form>
      </div>
      </div>

      {/* Account list */}
      <div className="fade-up fade-up-3">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>Accounts</p>
          <span className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{accounts.length}</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '72px' }} />)}
          </div>
        ) : accounts.length === 0 ? (
          <div style={{ border: '1px dashed var(--border)', borderRadius: '14px', padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No accounts yet.</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Open one above to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {groupedAccounts.map((group) => (
              <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                <div style={{ padding: '6px 4px 2px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {group.title}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {group.description}
                  </p>
                </div>
                {group.accounts.map((acc, index) => renderAccountCard(acc, index))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
