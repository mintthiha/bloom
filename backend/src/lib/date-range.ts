import { AppError } from "../middleware/errorHandler";

export type DateRange = {
  start: Date;
  end: Date;
};

function validateDate(value: Date, field: string) {
  if (Number.isNaN(value.getTime())) {
    throw new AppError(400, `${field} must be a valid ISO date`);
  }
}

export function defaultMonthRange(now = new Date()): DateRange {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export function resolveDateRange(input?: { start?: Date; end?: Date; now?: Date }): DateRange {
  if (!input?.start && !input?.end) {
    return defaultMonthRange(input?.now);
  }
  if (!input?.start || !input?.end) {
    throw new AppError(400, "start and end must both be provided");
  }

  validateDate(input.start, "start");
  validateDate(input.end, "end");

  if (input.start >= input.end) {
    throw new AppError(400, "start must be before end");
  }

  return { start: input.start, end: input.end };
}

export function parseDateRangeQuery(query: { start?: unknown; end?: unknown }) {
  const startValue = query.start;
  const endValue = query.end;

  if (startValue === undefined && endValue === undefined) {
    return undefined;
  }
  if (typeof startValue !== "string" || typeof endValue !== "string") {
    throw new AppError(400, "start and end must be ISO date strings");
  }

  return {
    start: new Date(startValue),
    end: new Date(endValue),
  };
}
