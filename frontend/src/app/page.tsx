"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api, Account, AccountType, Profile } from "@/lib/api";
import { ProfileFormPanel } from "@/components/profile-form-panel";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";

function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>("CHEQUING");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const deleted = searchParams.get("deleted");
    if (deleted) {
      toast.success(`${deleted} deleted`);
      router.replace("/");
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await api.listAccounts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

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
      await api.createAccount(ownerName.trim(), accountType);
      setOwnerName("");
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(n);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const chequingCount = accounts.filter(a => a.accountType === "CHEQUING").length;
  const savingsCount = accounts.filter(a => a.accountType === "SAVINGS").length;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>

      {/* Welcome */}
      <div className="fade-up" style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
          {profile?.firstName ? `Good morning, ${profile.firstName}.` : "Good morning."}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Here's your financial overview.
        </p>
      </div>

      {/* Stats row */}
      {accounts.length > 0 && (
        <div className="fade-up fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '36px' }}>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '10px' }}>Total Balance</p>
            <p className="num" style={{ fontSize: '22px', fontWeight: 500, color: '#f59e0b' }}>{fmt(totalBalance)}</p>
          </div>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '10px' }}>Chequing</p>
            <p className="num" style={{ fontSize: '22px', fontWeight: 500 }}>{chequingCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>acct{chequingCount !== 1 ? 's' : ''}</span></p>
          </div>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '10px' }}>Savings</p>
            <p className="num" style={{ fontSize: '22px', fontWeight: 500 }}>{savingsCount} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>acct{savingsCount !== 1 ? 's' : ''}</span></p>
          </div>
        </div>
      )}

      {/* Balance bar chart */}
      {accounts.length > 1 && (
        <div className="fade-up fade-up-1" style={{
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: '14px', padding: '24px', marginBottom: '32px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Account Balances
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={accounts.map(a => ({ name: a.ownerName.split(" ")[0], balance: a.balance, type: a.accountType }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={48} />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#9ca3af' }}
                cursor={{ fill: '#ffffff06' }}
              />
              <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                {accounts.map((a, i) => (
                  <Cell key={i} fill={a.accountType === 'SAVINGS' ? '#22c55e' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Open account */}
      <div className="fade-up fade-up-2" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px', marginBottom: '32px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>Open New Account</p>
        <form onSubmit={handleCreate}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
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
            {/* Account type toggle */}
            <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              {(["CHEQUING", "SAVINGS"] as AccountType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAccountType(t)}
                  style={{
                    padding: '10px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: accountType === t ? '#f59e0b' : 'transparent',
                    color: accountType === t ? '#000' : 'var(--text-secondary)',
                  }}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
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
              {creating ? "Opening…" : "Open"}
            </button>
          </div>
          {error && <p className="num" style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>{error}</p>}
        </form>
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
            {accounts.map((acc, i) => (
              <Link
                key={acc.id}
                href={`/account/${acc.id}`}
                className="fade-up"
                style={{
                  animationDelay: `${0.04 * i}s`,
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
                    background: acc.accountType === 'SAVINGS' ? '#16a34a22' : '#f59e0b22',
                    border: `1px solid ${acc.accountType === 'SAVINGS' ? '#16a34a44' : '#f59e0b44'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '15px', fontWeight: 700,
                    color: acc.accountType === 'SAVINGS' ? '#22c55e' : '#f59e0b',
                  }}>
                    {acc.ownerName[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px', marginBottom: '3px' }}>{acc.ownerName}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                        padding: '2px 6px', borderRadius: '4px',
                        background: acc.accountType === 'SAVINGS' ? '#16a34a22' : '#f59e0b22',
                        color: acc.accountType === 'SAVINGS' ? '#22c55e' : '#f59e0b',
                      }}>
                        {acc.accountType}
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
                  <span className="num" style={{ fontSize: '15px', fontWeight: 500, color: '#f59e0b' }}>{fmt(acc.balance)}</span>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
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
