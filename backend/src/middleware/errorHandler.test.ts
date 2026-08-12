import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, errorHandler } from "./errorHandler";

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json: json as ReturnType<typeof vi.fn> };
}

describe("AppError", () => {
  it("stores the statusCode and message", () => {
    const err = new AppError(404, "Not found");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err.name).toBe("AppError");
  });

  it("is an instance of Error", () => {
    expect(new AppError(400, "Bad request")).toBeInstanceOf(Error);
  });
});

describe("errorHandler middleware", () => {
  const next = vi.fn();

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("responds with the AppError's statusCode and message", () => {
    const res = makeRes();
    errorHandler(
      new AppError(422, "Unprocessable entity"),
      {} as never,
      res as never,
      next as never
    );
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.status().json).toHaveBeenCalledWith({ error: "Unprocessable entity" });
  });

  it("responds with 500 for unexpected non-AppError errors", () => {
    const res = makeRes();
    errorHandler(new Error("Something went wrong"), {} as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.status().json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("does not call next() for either error type", () => {
    const res = makeRes();
    errorHandler(new AppError(400, "Bad"), {} as never, res as never, next as never);
    errorHandler(new Error("Boom"), {} as never, res as never, next as never);
    expect(next).not.toHaveBeenCalled();
  });
});
