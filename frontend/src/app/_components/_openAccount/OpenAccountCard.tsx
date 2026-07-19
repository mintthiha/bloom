"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, AccountType } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";

type Props = {
  onCreated: (newAccountId: string) => Promise<void>;
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "14px",
  color: "var(--text-primary)",
};

/** Open new account card: collects owner name, optional nickname, and account type. */
export function OpenAccountCard({ onCreated }: Props) {
  const [ownerName, setOwnerName] = useState("");
  const [nickname, setNickname] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("CHEQUING");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Submits the create account form and resets on success. */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const newAccount = await api.createAccount(
        ownerName.trim(),
        accountType,
        nickname.trim() || undefined
      );
      setOwnerName("");
      setNickname("");
      await onCreated(newAccount.id);
      toast.success("Account opened");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setCreating(false);
    }
  }

  return (
    <CollapsibleCard eyebrow="Open New Account" className="fade-up fade-up-2" style={{}}>
      <form onSubmit={handleCreate}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: "10px",
            marginBottom: "12px",
            alignItems: "stretch",
          }}
        >
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Account nickname"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <input
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Account holder name"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <div style={{ display: "grid", gridTemplateColumns: "140px auto", gap: "10px" }}>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              aria-label="Account type"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: "var(--text-primary)",
                cursor: "pointer",
                appearance: "none",
                textAlign: "center",
                textAlignLast: "center",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
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
              className="press"
              disabled={creating || !ownerName.trim()}
              style={{
                padding: "10px 20px",
                background: "#3b82f6",
                color: "#000",
                fontWeight: 700,
                fontSize: "14px",
                border: "none",
                borderRadius: "8px",
                cursor: creating || !ownerName.trim() ? "not-allowed" : "pointer",
                opacity: creating || !ownerName.trim() ? 0.45 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {creating ? "Opening..." : "Open"}
            </button>
          </div>
        </div>
        {error && (
          <p className="num" style={{ color: "#f87171", fontSize: "12px", marginTop: "8px" }}>
            {error}
          </p>
        )}
      </form>
    </CollapsibleCard>
  );
}
