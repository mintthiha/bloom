import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireInternalSecret } from "./internalAuth";

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json: json as ReturnType<typeof vi.fn> };
}

function makeReq(secret?: string) {
  return { headers: { "x-internal-secret": secret } };
}

describe("requireInternalSecret middleware", () => {
  const next = vi.fn();
  const originalSecret = process.env.INTERNAL_API_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.INTERNAL_API_SECRET = originalSecret;
  });

  it("returns 503 when INTERNAL_API_SECRET is not configured", () => {
    delete process.env.INTERNAL_API_SECRET;
    const res = makeRes();
    requireInternalSecret(makeReq("any") as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.status().json).toHaveBeenCalledWith({ error: "Server misconfiguration" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the x-internal-secret header does not match", () => {
    process.env.INTERNAL_API_SECRET = "correct-secret";
    const res = makeRes();
    requireInternalSecret(makeReq("wrong-secret") as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.status().json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the header is absent", () => {
    process.env.INTERNAL_API_SECRET = "correct-secret";
    const res = makeRes();
    requireInternalSecret(makeReq(undefined) as never, res as never, next as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the secret matches", () => {
    process.env.INTERNAL_API_SECRET = "correct-secret";
    const res = makeRes();
    requireInternalSecret(makeReq("correct-secret") as never, res as never, next as never);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
