import { AppError } from "../middleware/errorHandler";

type StringOptions = {
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternMessage?: string;
  collapseWhitespace?: boolean;
};

function sanitizeStringValue(value: string, collapseWhitespace = true) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, collapseWhitespace ? " " : "")
    .trim();

  return collapseWhitespace ? normalized.replace(/\s+/g, " ") : normalized;
}

export function requireObject(value: unknown, message = "Request body must be an object") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, message);
  }
  return value as Record<string, unknown>;
}

export function requireString(
  value: unknown,
  field: string,
  options?: StringOptions
) {
  if (typeof value !== "string") {
    throw new AppError(400, `${field} must be a string`);
  }
  const normalized = sanitizeStringValue(value, options?.collapseWhitespace ?? true);
  if (!normalized) {
    throw new AppError(400, `${field} is required`);
  }
  if (options?.min !== undefined && normalized.length < options.min) {
    throw new AppError(400, `${field} must be at least ${options.min} characters`);
  }
  if (options?.max !== undefined && normalized.length > options.max) {
    throw new AppError(400, `${field} must be at most ${options.max} characters`);
  }
  if (options?.pattern && !options.pattern.test(normalized)) {
    throw new AppError(400, options.patternMessage ?? `${field} is invalid`);
  }
  return normalized;
}

export function optionalString(value: unknown, field: string, options?: Pick<StringOptions, "max" | "collapseWhitespace">) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AppError(400, `${field} must be a string`);
  }
  const normalized = sanitizeStringValue(value, options?.collapseWhitespace ?? true);
  if (!normalized) {
    return undefined;
  }
  if (options?.max !== undefined && normalized.length > options.max) {
    throw new AppError(400, `${field} must be at most ${options.max} characters`);
  }
  return normalized;
}

export function requirePositiveNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AppError(400, `${field} must be a number`);
  }
  if (value <= 0) {
    throw new AppError(400, `${field} must be positive`);
  }
  return value;
}
