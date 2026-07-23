import prisma from "../lib/prisma";
import { detectSubscriptions, type SubscriptionSummary } from "../lib/subscription-detection";
import { listRecurringTransactions } from "./recurringTransactionService";

/** Raw WITHDRAWAL charge row as returned by Postgres (amount arrives as a Decimal string). */
type ChargeRow = {
  merchant: string;
  amount: number | string;
  effectiveAt: Date;
};

/** How far back the detector looks for recurring charges. */
const LOOKBACK_MONTHS = 12;

/**
 * Builds the subscription summary for a user by detecting recurring merchant
 * charges from the last 12 months of WITHDRAWAL history and merging in the
 * user's active WITHDRAWAL recurring rules.
 */
export async function getSubscriptionSummary(userId: string): Promise<SubscriptionSummary> {
  const rows = await prisma.$queryRaw<ChargeRow[]>`
    SELECT
      t.merchant     AS merchant,
      t.amount       AS amount,
      t."effectiveAt" AS "effectiveAt"
    FROM "Transaction" t
    INNER JOIN "Account" a ON a.id = t."fromAccountId"
    WHERE a."userId" = ${userId}
      AND t.type = 'WITHDRAWAL'
      AND t.merchant IS NOT NULL
      AND t.merchant <> ''
      AND t."effectiveAt" >= NOW() - (${`${LOOKBACK_MONTHS} months`}::interval)
    ORDER BY t."effectiveAt" ASC
  `;

  const charges = rows.map((row) => ({
    merchant: row.merchant,
    amount: typeof row.amount === "string" ? parseFloat(row.amount) : row.amount,
    date: new Date(row.effectiveAt),
  }));

  const recurringRules = await listRecurringTransactions(userId);
  const withdrawalRules = recurringRules
    .filter((rule) => rule.type === "WITHDRAWAL" && rule.active)
    .map((rule) => ({
      merchant: rule.merchant,
      name: rule.name,
      amount: rule.amount,
      frequency: rule.frequency,
    }));

  return detectSubscriptions(charges, withdrawalRules);
}
