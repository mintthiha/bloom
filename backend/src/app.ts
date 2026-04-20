import express from "express";
import accountsRouter from "./routes/accounts";
import budgetsRouter from "./routes/budgets";
import profileRouter from "./routes/profile";
import recurringRouter from "./routes/recurring";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bloom-api" });
});

app.use("/api/accounts", accountsRouter);
app.use("/api/budgets", budgetsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/recurring", recurringRouter);
app.use(errorHandler);

export default app;
