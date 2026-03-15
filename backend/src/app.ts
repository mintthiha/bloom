import express from "express";
import accountsRouter from "./routes/accounts";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bloom-api" });
});

app.use("/api/accounts", accountsRouter);
app.use(errorHandler);

export default app;
