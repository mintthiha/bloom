import express from "express";
import pinoHttp from "pino-http";
import accountsRouter from "./routes/accounts";
import budgetsRouter from "./routes/budgets";
import profileRouter from "./routes/profile";
import recurringRouter from "./routes/recurring";
import savingsGoalsRouter from "./routes/savingsGoals";
import transactionsRouter from "./routes/transactions";
import plaidRouter from "./routes/plaid";
import { errorHandler } from "./middleware/errorHandler";
import { requireInternalSecret } from "./middleware/internalAuth";
import logger from "./lib/logger";
import prisma from "./lib/prisma";

const app = express();
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
app.use("/api/savings-goals", savingsGoalsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/plaid", plaidRouter);
app.use(errorHandler);

export default app;
