import prisma from "./lib/prisma";

/**
 * Deletes every row belonging to a demo user's data across all app tables,
 * then the CredentialUser row itself (which cascades its RememberTokens).
 * Mirrors the deletion order in mintthiha-budgets-setup-seed.ts's resetUser,
 * extended to the tables a demo account can actually touch.
 */
async function deleteDemoUser(userId: string) {
  await prisma.$executeRaw`
    DELETE FROM "Transaction"
    WHERE "fromAccountId" IN (SELECT "id" FROM "Account" WHERE "userId" = ${userId})
       OR "toAccountId" IN (SELECT "id" FROM "Account" WHERE "userId" = ${userId})
  `;
  await prisma.$executeRaw`DELETE FROM "SavingsGoal" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "RecurringTransaction" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "BudgetPeriod" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "CategoryBudget" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "NetWorthSnapshot" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "ManualEntry" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "AutoCategorizationRule" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "ActivityLog" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "Notification" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "Account" WHERE "userId" = ${userId}`;
  await prisma.$executeRaw`DELETE FROM "Profile" WHERE "userId" = ${userId}`;
  await prisma.credentialUser.delete({ where: { id: userId } });
}

/**
 * Finds every demo CredentialUser whose TTL has passed and deletes it along
 * with all of its seeded data. Intended to run on a periodic schedule (e.g. an
 * external OS or platform cron) since this repo has no in-process scheduler.
 */
async function main() {
  const expired = await prisma.credentialUser.findMany({
    where: { isDemo: true, demoExpiresAt: { lt: new Date() } },
    select: { id: true, email: true },
  });

  console.log(`Found ${expired.length} expired demo account(s).`);
  for (const user of expired) {
    await deleteDemoUser(user.id);
    console.log(`Deleted demo account ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
