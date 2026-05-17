"use client";

import { Account } from "@/lib/api";
import { DeleteAccount } from "../_accountActions/DeleteAccount";
import { FreezeButton } from "../_accountActions/FreezeButton";

const ACCOUNT_TYPE_META = {
  CHEQUING: { label: "Chequing", color: "#f59e0b" },
  SAVINGS: { label: "Savings", color: "#22c55e" },
  TFSA: { label: "TFSA", color: "#38bdf8" },
  RRSP: { label: "RRSP", color: "#a78bfa" },
  FHSA: { label: "FHSA", color: "#fb7185" },
  CREDIT: { label: "Credit", color: "#ef4444" },
} as const;

/** Formats a number as CAD currency. */
const fmt = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(n);

type AccountCardProps = {
  account: Account | null;
  onRefresh: () => void;
};

/** Displays account summary info, balance, freeze toggle, and delete action. */
export function AccountCard({ account, onRefresh }: AccountCardProps) {
  if (!account) return null;

  const accentColor = ACCOUNT_TYPE_META[account.accountType].color;
  const displayName = account.nickname ?? account.ownerName;

  return (
    <div
      className="fade-up fade-up-1"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "28px",
        marginBottom: "16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative glow */}
      <div
        style={{
          position: "absolute",
          top: "-40px",
          right: "-40px",
          width: "160px",
          height: "160px",
          borderRadius: "50%",
          background: `${accentColor}10`,
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "6px",
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-0.3px",
              }}
            >
              {displayName}
            </h1>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "3px 8px",
                borderRadius: "5px",
                background: `${accentColor}20`,
                color: accentColor,
              }}
            >
              {ACCOUNT_TYPE_META[account.accountType].label}
            </span>
            {account.frozen && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "3px 8px",
                  borderRadius: "5px",
                  background: "#3b82f620",
                  color: "#60a5fa",
                }}
              >
                FROZEN
              </span>
            )}
          </div>
          {account.nickname && (
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Account holder: {account.ownerName}
            </p>
          )}
          <p
            className="num"
            style={{ fontSize: "12px", color: "var(--text-muted)" }}
          >
            {account.id}
          </p>
        </div>
        <div
          style={{
            textAlign: "right",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "10px",
            marginLeft: "auto",
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
                marginBottom: "6px",
              }}
            >
              {account.accountType === "CREDIT"
                ? "Outstanding Balance"
                : "Available Balance"}
            </p>
            <p
              className="num"
              style={{
                fontSize: "30px",
                fontWeight: 500,
                color: accentColor,
              }}
            >
              {fmt(account.balance)}
            </p>
          </div>
          <FreezeButton
            accountId={account.id}
            frozen={account.frozen}
            onToggled={onRefresh}
          />
          <DeleteAccount
            accountId={account.id}
            displayName={displayName}
          />
        </div>
      </div>
    </div>
  );
}
