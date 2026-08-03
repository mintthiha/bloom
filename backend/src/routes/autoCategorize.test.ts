import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const VALID_SUGGESTIONS = [
  { merchant: "Loblaws", category: "Groceries" },
  { merchant: "Netflix", category: "Entertainment" },
];

/** Builds a mock fetch response containing Ollama's non-streaming chat completion shape. */
function makeOllamaResponse(suggestions: { merchant: string; category: string }[]) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      message: { content: JSON.stringify({ suggestions }) },
    }),
  };
}

describe("auto-categorize routes", () => {
  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ merchants: ["Loblaws"] });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns suggestions for a valid list of merchants", async () => {
    fetchMock.mockResolvedValue(makeOllamaResponse(VALID_SUGGESTIONS));

    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchants: ["Loblaws", "Netflix"] });

    expect(response.status).toBe(200);
    expect(response.body.suggestions).toHaveLength(2);
    expect(response.body.suggestions[0]).toMatchObject({
      merchant: "Loblaws",
      category: "Groceries",
    });
    expect(response.body.suggestions[1]).toMatchObject({
      merchant: "Netflix",
      category: "Entertainment",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("filters out suggestions with invalid categories", async () => {
    const withInvalid = [
      ...VALID_SUGGESTIONS,
      { merchant: "Unknown Corp", category: "NotACategory" },
    ];
    fetchMock.mockResolvedValue(makeOllamaResponse(withInvalid));

    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchants: ["Loblaws", "Netflix", "Unknown Corp"] });

    expect(response.status).toBe(200);
    expect(response.body.suggestions).toHaveLength(2);
    expect(response.body.suggestions.map((s: { merchant: string }) => s.merchant)).not.toContain(
      "Unknown Corp"
    );
  });

  it("returns 503 when Ollama is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchants: ["Loblaws"] });

    expect(response.status).toBe(503);
  });

  it("returns 503 when Ollama responds with a non-ok status", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: vi.fn() });

    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchants: ["Loblaws"] });

    expect(response.status).toBe(503);
  });

  it("returns 400 when merchants is missing", async () => {
    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({});

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when merchants is an empty array", async () => {
    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchants: [] });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when merchants is not an array", async () => {
    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchants: "Loblaws" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when merchants exceeds the maximum limit of 20", async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `Merchant ${i}`);

    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchants: tooMany });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when a merchant entry is not a string", async () => {
    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .set("X-User-Id", "user-1")
      .send({ merchants: ["Loblaws", 42] });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
