"use client";
import { useRouter } from "next/navigation";
import { Account } from "@/lib/api";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { CollapsibleCard } from "@/components/collapsible-card";
import { formatCurrency } from "@/lib/format";

type Props = {
  accounts: Account[];
};

const POSITIVE_COLOR = "#22c55e";
const NEGATIVE_COLOR = "#ef4444";

/** Credit balances are stored as positive amounts owed; sign them negative so totals and bars mirror the dashboard's net-worth math. */
function toSignedBalance(account: Account): number {
  return account.accountType === "CREDIT" ? -account.balance : account.balance;
}

/** Header pill showing the combined total, kept visible while the card is collapsed — mirrors the Safe to Spend badge. */
function TotalBadge({ total }: { total: number }) {
  const color = total >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
  return (
    <span
      className="num"
      style={{
        fontSize: "15px",
        fontWeight: 800,
        padding: "2px 9px",
        borderRadius: "7px",
        background: `${color}18`,
        border: `1px solid ${color}44`,
        color,
      }}
    >
      {total < 0 ? "−" : ""}
      {formatCurrency(Math.abs(total))}
    </span>
  );
}

/** Account balances list card — one ranked row per account with a proportional magnitude bar; click navigates to the account page. */
export function AccountBalancesCard({ accounts }: Props) {
  const router = useRouter();

  const rows = accounts
    .map((account) => ({
      id: account.id,
      name: account.nickname ?? account.ownerName,
      type: account.accountType,
      balance: toSignedBalance(account),
    }))
    .sort((first, second) => second.balance - first.balance);

  const total = rows.reduce((sum, row) => sum + row.balance, 0);
  // Scale every bar against the largest magnitude so a near-zero or negative account still reads at a glance.
  const maxMagnitude = Math.max(...rows.map((row) => Math.abs(row.balance)), 1);

  return (
    <CollapsibleCard
      eyebrow="Account Balances"
      title="Balances at a glance"
      description="Every account ranked by balance, with credit shown as what you owe."
      className="fade-up fade-up-1"
      headerRight={<TotalBadge total={total} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {rows.map((row) => {
          const meta = ACCOUNT_TYPE_META[row.type];
          const isNegative = row.balance < 0;
          const fillWidth = `${(Math.abs(row.balance) / maxMagnitude) * 100}%`;
          return (
            <button
              key={row.id}
              type="button"
              className="balance-row"
              onClick={() => router.push(`/account/${row.id}`)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "1px solid transparent",
                borderRadius: "10px",
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      background: meta.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.name}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: meta.color,
                      background: meta.soft,
                      border: `1px solid ${meta.border}`,
                      borderRadius: "9999px",
                      padding: "1px 7px",
                      flexShrink: 0,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <span
                  className="num"
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: isNegative ? NEGATIVE_COLOR : "var(--text-primary)",
                    flexShrink: 0,
                  }}
                >
                  {formatCurrency(row.balance)}
                </span>
              </div>
              <div
                style={{
                  height: "6px",
                  borderRadius: "9999px",
                  background: "var(--surface-3)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: fillWidth,
                    height: "100%",
                    borderRadius: "9999px",
                    background: meta.color,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </CollapsibleCard>
  );
}
