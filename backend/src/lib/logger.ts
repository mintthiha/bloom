import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(isDevelopment && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});

export default logger;
