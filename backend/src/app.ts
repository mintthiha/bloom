import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import accountsRouter from "./routes/accounts";
import budgetsRouter from "./routes/budgets";
import profileRouter from "./routes/profile";
import recurringRouter from "./routes/recurring";
import notificationsRouter from "./routes/notifications";
import savingsGoalsRouter from "./routes/savingsGoals";
import subscriptionsRouter from "./routes/subscriptions";
import transactionsRouter from "./routes/transactions";
import plaidRouter from "./routes/plaid";
import categorizationRulesRouter from "./routes/categorizationRules";
import categoriesRouter from "./routes/categories";
import autoCategorizeRouter from "./routes/autoCategorize";
import receiptsRouter from "./routes/receipts";
import quickAddRouter from "./routes/quickAdd";
import aiChatRouter from "./routes/aiChat";
import chatMessagesRouter from "./routes/chatMessages";
import credentialsAuthRouter from "./routes/credentialsAuth";
import activityRouter from "./routes/activity";
import manualEntriesRouter from "./routes/manualEntries";
import userDataRouter from "./routes/userData";
import exchangeRatesRouter from "./routes/exchangeRates";
import { errorHandler } from "./middleware/errorHandler";
import { requireInternalSecret } from "./middleware/internalAuth";
import { createAiRateLimiter } from "./middleware/aiRateLimit";
import { createRequestRateLimiter } from "./middleware/requestRateLimit";
import logger from "./lib/logger";
import prisma from "./lib/prisma";

const app = express();
app.use(helmet());
app.use(createRequestRateLimiter());
app.use(express.json());
app.use(pinoHttp({ logger }));

/** Returns 200 when the API and Postgres are reachable, 503 otherwise. */
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", service: "bloom-api", db: "ok" });
  } catch {
    res.status(503).json({ status: "error", service: "bloom-api", db: "unreachable" });
  }
});

app.use("/api", requireInternalSecret);

app.use("/api/accounts", accountsRouter);
app.use("/api/budgets", budgetsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/recurring", recurringRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/savings-goals", savingsGoalsRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/plaid", plaidRouter);
app.use("/api/categorization-rules", categorizationRulesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/activity", activityRouter);
app.use("/api/manual-entries", manualEntriesRouter);
app.use("/api/user-data", userDataRouter);
app.use("/api/exchange-rates", exchangeRatesRouter);
app.use("/api/chat-messages", chatMessagesRouter);
app.use("/api/auto-categorize", createAiRateLimiter("categorization"), autoCategorizeRouter);
app.use("/api/receipts", createAiRateLimiter("receipt"), receiptsRouter);
app.use("/api/quick-add", createAiRateLimiter("quickAdd"), quickAddRouter);
app.use("/api/internal/ai", createAiRateLimiter("chat"), aiChatRouter);
// Rate-limited per email and per visitor inside the router: a limiter keyed on req.ip here would be
// one budget shared by every visitor, since all requests arrive from the Next.js server.
app.use("/api/credentials-auth", credentialsAuthRouter);
app.use(errorHandler);

export default app;
