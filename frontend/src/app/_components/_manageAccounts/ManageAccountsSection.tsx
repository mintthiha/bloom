import Link from "next/link";
import { LinkBankAccountCard } from "../_linkAccount/LinkBankAccountCard";
import { OpenAccountCard } from "../_openAccount/OpenAccountCard";

interface ManageAccountsSectionProps {
  /** Grid columns, matching the card grid above. */
  columns: string;
  /** Called with the new account's id after "Open account" succeeds. */
  onAccountCreated: (newAccountId: string) => Promise<void>;
  /** Called after a bank is linked through Plaid. */
  onBankLinked: () => Promise<void>;
}

/** Labeled section below the data cards for opening or linking accounts. */
export function ManageAccountsSection({
  columns,
  onAccountCreated,
  onBankLinked,
}: ManageAccountsSectionProps) {
  return (
    <>
      {/* Labeled boundary that separates the account-management actions from the data cards above. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginTop: "40px",
          marginBottom: "18px",
        }}
      >
        <p
          style={{
            fontSize: "13px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          Manage Accounts
        </p>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        <Link
          href="/accounts"
          className="press"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--brand-accent-light)",
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          View all accounts
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Open New Account + Link Bank Account (utility cards, not reorderable) */}
      <div
        id="open-account-section"
        style={{
          display: "grid",
          gridTemplateColumns: columns,
          gap: "20px",
          alignItems: "start",
          marginBottom: "32px",
        }}
      >
        <OpenAccountCard onCreated={onAccountCreated} />
        <LinkBankAccountCard onLinked={onBankLinked} />
      </div>
    </>
  );
}
