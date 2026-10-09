import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { AppError } from "../middleware/errorHandler";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: { suggestCategories: vi.fn(), startCategorySuggestionStream: vi.fn() },
}));

vi.mock("../services/autoCategorizeService", () => serviceMock);

const VALID_SUGGESTIONS = [
  { merchant: "Loblaws", category: "Groceries" },
  { merchant: "Netflix", category: "Entertainment" },
];

/** Builds the generator of suggestions the service would hand back for a streamed request. */
async function* suggestionStreamOf(
  suggestions: { merchant: string; category: string }[]
): AsyncGenerator<{ merchant: string; category: string }, void, void> {
  for (const suggestion of suggestions) yield suggestion;
}

/** Posts to an auto-categorize endpoint as the Next.js proxy would for a signed-in user. */
function postAsUser(path: string, body: unknown) {
  return request(app)
    .post(`/api/auto-categorize/${path}`)
    .set("X-Internal-Secret", INTERNAL_SECRET)
    .set("X-User-Id", "user-1")
    .send(body as object);
}

beforeEach(() => {
  serviceMock.suggestCategories.mockReset();
  serviceMock.startCategorySuggestionStream.mockReset();
});

describe("auto-categorize suggest route", () => {
  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .post("/api/auto-categorize/suggest")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ merchants: ["Loblaws"] });

    expect(response.status).toBe(401);
    expect(serviceMock.suggestCategories).not.toHaveBeenCalled();
  });

  it("returns the service's suggestions for a valid list of merchants", async () => {
    serviceMock.suggestCategories.mockResolvedValue(VALID_SUGGESTIONS);

    const response = await postAsUser("suggest", { merchants: ["Loblaws", "Netflix"] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ suggestions: VALID_SUGGESTIONS });
    expect(serviceMock.suggestCategories).toHaveBeenCalledWith("user-1", ["Loblaws", "Netflix"]);
  });

  it("trims each merchant and caps it at 100 characters before calling the service", async () => {
    serviceMock.suggestCategories.mockResolvedValue([]);

    await postAsUser("suggest", { merchants: ["  Loblaws  ", "x".repeat(150)] });

    expect(serviceMock.suggestCategories).toHaveBeenCalledWith("user-1", [
      "Loblaws",
      "x".repeat(100),
    ]);
  });

  it("accepts exactly the maximum of 20 merchants", async () => {
    serviceMock.suggestCategories.mockResolvedValue([]);
    const merchants = Array.from({ length: 20 }, (_, index) => `Merchant ${index}`);

    const response = await postAsUser("suggest", { merchants });

    expect(response.status).toBe(200);
    expect(serviceMock.suggestCategories).toHaveBeenCalledWith("user-1", merchants);
  });

  it("returns 503 when the AI service is unavailable", async () => {
    serviceMock.suggestCategories.mockRejectedValue(new AppError(503, "AI service unavailable"));

    const response = await postAsUser("suggest", { merchants: ["Loblaws"] });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "AI service unavailable" });
  });

  it.each([
    ["merchants is missing", {}],
    ["merchants is an empty array", { merchants: [] }],
    ["merchants is not an array", { merchants: "Loblaws" }],
    [
      "merchants exceeds the maximum of 20",
      { merchants: Array.from({ length: 21 }, (_, index) => `Merchant ${index}`) },
    ],
    ["a merchant entry is not a string", { merchants: ["Loblaws", 42] }],
    ["a merchant entry is blank", { merchants: ["Loblaws", "   "] }],
  ])("returns 400 when %s", async (_description, body) => {
    const response = await postAsUser("suggest", body);

    expect(response.status).toBe(400);
    expect(serviceMock.suggestCategories).not.toHaveBeenCalled();
  });
});

describe("auto-categorize suggest-stream route", () => {
  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .post("/api/auto-categorize/suggest-stream")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ merchants: ["Loblaws"] });

    expect(response.status).toBe(401);
    expect(serviceMock.startCategorySuggestionStream).not.toHaveBeenCalled();
  });

  it("emits one SSE data event per suggestion, then a done event", async () => {
    serviceMock.startCategorySuggestionStream.mockResolvedValue(
      suggestionStreamOf(VALID_SUGGESTIONS)
    );

    const response = await postAsUser("suggest-stream", { merchants: ["Loblaws", "Netflix"] });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.text).toBe(
      'data: {"merchant":"Loblaws","category":"Groceries"}\n\n' +
        'data: {"merchant":"Netflix","category":"Entertainment"}\n\n' +
        "event: done\ndata: {}\n\n"
    );
    expect(serviceMock.startCategorySuggestionStream).toHaveBeenCalledWith(
      "user-1",
      ["Loblaws", "Netflix"],
      expect.any(AbortSignal)
    );
  });

  it("emits an SSE error event when the AI service is unavailable", async () => {
    serviceMock.startCategorySuggestionStream.mockRejectedValue(
      new AppError(503, "AI service unavailable")
    );

    const response = await postAsUser("suggest-stream", { merchants: ["Loblaws"] });

    expect(response.status).toBe(200);
    expect(response.text).toBe('event: error\ndata: {"message":"AI service unavailable"}\n\n');
  });

  it("returns 400 before opening the stream when the payload is invalid", async () => {
    const response = await postAsUser("suggest-stream", { merchants: [] });

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(serviceMock.startCategorySuggestionStream).not.toHaveBeenCalled();
  });
});
