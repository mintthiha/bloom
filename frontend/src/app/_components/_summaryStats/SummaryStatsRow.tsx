import type { Account, ManualEntry } from "@/lib/api";
import { AnimatedCount } from "@/components/animated-count";
import { AnimatedCurrency } from "@/components/animated-currency";
import { summarizeAccounts } from "./account-summary";
import { SummaryStatCard } from "./SummaryStatCard";

/** "3 accts" — an animated count with a muted unit. */
function AccountCount({ count }: { count: number }) {
  return (
    <>
      <AnimatedCount value={count} />{" "}
      <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
        acct{count !== 1 ? "s" : ""}
      </span>
    </>
  );
}

/** The dashboard's top row: net worth, cash, and per-type account counts, each linking onward. */
export function SummaryStatsRow({
  accounts,
  manualEntries,
}: {
  accounts: Account[];
  manualEntries: ManualEntry[];
}) {
  const summary = summarizeAccounts(accounts, manualEntries);
  const hasCredit = summary.creditAccounts.length > 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        marginBottom: "36px",
      }}
    >
      <SummaryStatCard
        title="Net Worth"
        value={<AnimatedCurrency value={summary.netWorth} />}
        flashKey={summary.netWorth}
        color={summary.netWorth >= 0 ? "var(--positive)" : "var(--negative)"}
        staggerIndex={0}
      />
      <SummaryStatCard
        title="Total Cash"
        value={<AnimatedCurrency value={summary.totalCash} />}
        flashKey={summary.totalCash}
        color="var(--brand-accent-light)"
        targetAccount={summary.cashAccounts[0]}
        staggerIndex={1}
      />
      <SummaryStatCard
        title="Chequing"
        value={<AccountCount count={summary.chequingAccounts.length} />}
        flashKey={summary.chequingAccounts.length}
        targetAccount={summary.chequingAccounts[0]}
        staggerIndex={2}
      />
      <SummaryStatCard
        title="Savings"
        value={<AccountCount count={summary.savingsAccounts.length} />}
        flashKey={summary.savingsAccounts.length}
        targetAccount={summary.savingsAccounts[0]}
        staggerIndex={3}
      />
      <SummaryStatCard
        title="Registered"
        value={<AccountCount count={summary.registeredAccounts.length} />}
        flashKey={summary.registeredAccounts.length}
        targetAccount={summary.registeredAccounts[0]}
        staggerIndex={4}
      />
      <SummaryStatCard
        title="Credit"
        value={
          hasCredit ? (
            <>
              <AnimatedCurrency value={summary.totalCredit} />{" "}
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>owed</span>
            </>
          ) : (
            <AccountCount count={summary.creditAccounts.length} />
          )
        }
        flashKey={hasCredit ? summary.totalCredit : summary.creditAccounts.length}
        color={hasCredit ? "var(--negative)" : undefined}
        targetAccount={summary.creditAccounts[0]}
        staggerIndex={5}
      />
    </div>
  );
}
