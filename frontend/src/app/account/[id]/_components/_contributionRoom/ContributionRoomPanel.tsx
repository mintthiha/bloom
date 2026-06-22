import type { Account, Profile, Transaction } from "@/lib/api";
import { TfsaRoomPanel } from "./TfsaRoomPanel";
import { RrspRoomPanel } from "./RrspRoomPanel";
import { FhsaRoomPanel } from "./FhsaRoomPanel";

type ContributionRoomPanelProps = {
  account: Account;
  sameTypeTransactions: Transaction[];
  sameTypeAccountIds: string[];
  profile: Profile | null;
};

/**
 * Dispatches to the correct registered-account contribution room panel based on account type.
 * Renders nothing for non-registered account types.
 */
export function ContributionRoomPanel({
  account,
  sameTypeTransactions,
  sameTypeAccountIds,
  profile,
}: ContributionRoomPanelProps) {
  if (account.accountType === "TFSA") {
    return (
      <TfsaRoomPanel
        transactions={sameTypeTransactions}
        accountIds={sameTypeAccountIds}
        profile={profile}
      />
    );
  }
  if (account.accountType === "RRSP") {
    return (
      <RrspRoomPanel
        transactions={sameTypeTransactions}
        accountIds={sameTypeAccountIds}
        profile={profile}
      />
    );
  }
  if (account.accountType === "FHSA") {
    return <FhsaRoomPanel transactions={sameTypeTransactions} accountIds={sameTypeAccountIds} />;
  }
  return null;
}
