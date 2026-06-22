import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { AccountType, TransactionType } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import prisma from "../lib/prisma";

/** Lazily initialized singleton — created on first use to avoid startup failure when credentials are absent. */
let plaidClientSingleton: PlaidApi | null = null;

/** Returns the shared Plaid API client, creating it on first call. Throws 503 if credentials are not set. */
function getPlaidClient(): PlaidApi {
  if (plaidClientSingleton) return plaidClientSingleton;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;

  if (!clientId || !secret) {
    throw new AppError(
      503,
      "Plaid credentials not configured — set PLAID_CLIENT_ID and PLAID_SECRET in backend/.env"
    );
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env] ?? PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  plaidClientSingleton = new PlaidApi(configuration);
  return plaidClientSingleton;
}

/** Maps a Plaid account subtype to the closest Bloom AccountType. Unknown subtypes default to CHEQUING. */
function mapSubtypeToAccountType(subtype: string | null | undefined): AccountType {
  switch (subtype) {
    case "checking":
      return AccountType.CHEQUING;
    case "savings":
      return AccountType.SAVINGS;
    case "money market":
      return AccountType.SAVINGS;
    case "credit card":
      return AccountType.CREDIT;
    default:
      return AccountType.CHEQUING;
  }
}

/** Creates a Plaid Link token for the given user to open the Link modal. */
export async function createLinkToken(userId: string): Promise<string> {
  const client = getPlaidClient();

  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Bloom",
    products: [Products.Auth, Products.Transactions],
    country_codes: [CountryCode.Us, CountryCode.Ca],
    language: "en",
  });

  return response.data.link_token;
}

/**
 * Exchanges a Plaid public token for a persistent access token, persists the PlaidItem,
 * and immediately syncs accounts and transactions for the new item.
 */
export async function exchangePublicToken(
  publicToken: string,
  userId: string,
  institutionName: string
): Promise<{ itemId: string; accountsLinked: number }> {
  const client = getPlaidClient();

  const tokenResponse = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const { access_token: accessToken, item_id: itemId } = tokenResponse.data;

  await prisma.plaidItem.upsert({
    where: { itemId },
    create: { userId, accessToken, itemId, institutionName },
    update: { accessToken, institutionName },
  });

  const accountsLinked = await syncAccountsAndTransactions(itemId, userId);
  return { itemId, accountsLinked };
}

/**
 * Fetches all accounts and transactions for a PlaidItem and upserts them into Bloom.
 * Transactions are synced from the beginning (no cursor stored) so this is a full re-sync.
 * Returns the number of Bloom accounts that were linked.
 */
export async function syncAccountsAndTransactions(itemId: string, userId: string): Promise<number> {
  const plaidItem = await prisma.plaidItem.findUnique({ where: { itemId } });

  if (!plaidItem || plaidItem.userId !== userId) {
    throw new AppError(404, "Plaid item not found");
  }

  const client = getPlaidClient();

  // --- Sync accounts ---
  const accountsResponse = await client.accountsGet({
    access_token: plaidItem.accessToken,
  });
  const plaidAccounts = accountsResponse.data.accounts;

  const bloomAccounts = await Promise.all(
    plaidAccounts.map((plaidAccount) => {
      const accountType = mapSubtypeToAccountType(plaidAccount.subtype);
      const balance = plaidAccount.balances.current ?? 0;

      return prisma.account.upsert({
        where: { plaidAccountId: plaidAccount.account_id },
        create: {
          userId,
          ownerName: plaidAccount.name,
          accountType,
          balance,
          isLinked: true,
          plaidAccountId: plaidAccount.account_id,
          plaidItemId: itemId,
          institutionName: plaidItem.institutionName,
        },
        update: {
          balance,
          ownerName: plaidAccount.name,
          institutionName: plaidItem.institutionName,
        },
      });
    })
  );

  // Build a map from Plaid account_id → Bloom account id for fast lookup
  const accountIdMap = new Map(
    plaidAccounts.map((plaidAccount, index) => [plaidAccount.account_id, bloomAccounts[index].id])
  );

  // Use transactionsGet (date-range based) instead of transactionsSync.
  // transactionsGet works immediately in sandbox without requiring a webhook handshake,
  // whereas transactionsSync needs INITIAL_UPDATE to fire first.
  const startDate = "2020-01-01";
  const endDate = new Date().toISOString().split("T")[0];
  const pageSize = 500;

  const allPlaidTransactions = [];
  let offset = 0;
  let totalTransactions = Infinity;

  while (allPlaidTransactions.length < totalTransactions) {
    const txnResponse = await client.transactionsGet({
      access_token: plaidItem.accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: pageSize, offset },
    });
    allPlaidTransactions.push(...txnResponse.data.transactions);
    totalTransactions = txnResponse.data.total_transactions;
    offset += txnResponse.data.transactions.length;
    if (txnResponse.data.transactions.length === 0) break;
  }

  await Promise.all(
    allPlaidTransactions.map((txn) => {
      const bloomAccountId = accountIdMap.get(txn.account_id);
      if (!bloomAccountId) return;

      // Plaid sign convention: positive = debit (outflow), negative = credit (inflow).
      const isDeposit = txn.amount < 0;
      const absAmount = Math.abs(txn.amount);
      const transactionType = isDeposit ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL;
      const effectiveAt = new Date(txn.date);
      const category = txn.category?.[0] ?? null;
      const merchantName = txn.merchant_name ?? txn.name;

      return prisma.transaction.upsert({
        where: { plaidTransactionId: txn.transaction_id },
        create: {
          type: transactionType,
          amount: absAmount,
          // Running balance not computable for historical synced data; set to 0.
          balanceAfter: 0,
          category,
          merchant: merchantName,
          description: txn.name,
          effectiveAt,
          plaidTransactionId: txn.transaction_id,
          ...(isDeposit ? { toAccountId: bloomAccountId } : { fromAccountId: bloomAccountId }),
        },
        update: {
          amount: absAmount,
          category,
          merchant: merchantName,
          description: txn.name,
        },
      });
    })
  );

  return bloomAccounts.length;
}
