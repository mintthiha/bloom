// import { PrismaClient } from "@prisma/client";
// import { randomUUID } from "crypto";

// const prisma = new PrismaClient();

// async function main() {
//   // Find all unique userIds from existing accounts
//   const accounts = await prisma.account.findMany({ select: { userId: true } });
//   const userIds = [...new Set(accounts.map((a) => a.userId))];

//   if (userIds.length === 0) {
//     console.log("No users found — create an account on the dashboard first.");
//     return;
//   }

//   for (const userId of userIds) {
//     // Get the current snapshot for this month if it exists
//     const today = new Date();
//     const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
//     const existing = await prisma.netWorthSnapshot.findUnique({
//       where: { userId_month: { userId, month: currentMonth } },
//     });

//     // Use real current values or fall back to sensible defaults
//     const currentNetWorth = existing?.netWorth ?? 5000;
//     const currentAssets = existing?.totalAssets ?? 6000;
//     const currentDebt = existing?.totalDebt ?? 1000;

//     // Seed 11 prior months, working backwards from current values
//     // Simulate modest growth: each prior month is slightly less
//     for (let i = 11; i >= 1; i--) {
//       const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
//       const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

//       // Slight random variance per month (~2-5% step down going back)
//       const factor = 1 - i * 0.03 - (Math.random() * 0.02 - 0.01);
//       const totalAssets = Math.round(currentAssets * factor * 100) / 100;
//       const totalDebt = Math.round(currentDebt * (1 + i * 0.015) * 100) / 100;
//       const netWorth = Math.round((totalAssets - totalDebt) * 100) / 100;

//       await prisma.netWorthSnapshot.upsert({
//         where: { userId_month: { userId, month } },
//         update: { netWorth, totalAssets, totalDebt },
//         create: { id: randomUUID(), userId, month, netWorth, totalAssets, totalDebt },
//       });

//       console.log(`  ${month}: assets=${totalAssets}, debt=${totalDebt}, net=${netWorth}`);
//     }

//     console.log(`Seeded 11 historical snapshots for user ${userId}`);
//   }
// }

// main()
//   .catch(console.error)
//   .finally(() => prisma.$disconnect());
