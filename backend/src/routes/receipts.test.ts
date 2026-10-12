import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { AppError } from "../middleware/errorHandler";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: { startReceiptItemCategoryStream: vi.fn() },
}));

vi.mock("../services/receiptCategorizeService", () => serviceMock);

type ItemCategory = { itemNumber: number; category: string };

/** Builds the generator of item categories the service would hand back for a streamed request. */
async function* itemCategoryStreamOf(
  itemCategories: ItemCategory[]
): AsyncGenerator<ItemCategory, void, void> {
  for (const itemCategory of itemCategories) yield itemCategory;
}

/** Posts to the receipt categorization endpoint as the Next.js proxy would for a signed-in user. */
function postAsUser(body: unknown) {
  return request(app)
    .post("/api/receipts/categorize-stream")
    .set("X-Internal-Secret", INTERNAL_SECRET)
    .set("X-User-Id", "user-1")
    .send(body as object);
}

beforeEach(() => {
  serviceMock.startReceiptItemCategoryStream.mockReset();
});

describe("receipt categorize-stream route", () => {
  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .post("/api/receipts/categorize-stream")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ items: ["BANANAS"] });

    expect(response.status).toBe(401);
    expect(serviceMock.startReceiptItemCategoryStream).not.toHaveBeenCalled();
  });

  it("emits one SSE data event per item category, then a done event", async () => {
    serviceMock.startReceiptItemCategoryStream.mockResolvedValue(
      itemCategoryStreamOf([
        { itemNumber: 1, category: "Groceries" },
        { itemNumber: 2, category: "Household" },
      ])
    );

    const response = await postAsUser({ merchant: "Walmart", items: ["BANANAS", "DISH SOAP"] });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.text).toBe(
      'data: {"itemNumber":1,"category":"Groceries"}\n\n' +
        'data: {"itemNumber":2,"category":"Household"}\n\n' +
        "event: done\ndata: {}\n\n"
    );
    expect(serviceMock.startReceiptItemCategoryStream).toHaveBeenCalledWith(
      "user-1",
      "Walmart",
      ["BANANAS", "DISH SOAP"],
      expect.any(AbortSignal)
    );
  });

  it("flattens whitespace in each item, caps it at 60 characters, and allows a missing merchant", async () => {
    serviceMock.startReceiptItemCategoryStream.mockResolvedValue(itemCategoryStreamOf([]));

    await postAsUser({ items: ["  ORG\nBANANAS  ", "x".repeat(80)] });

    expect(serviceMock.startReceiptItemCategoryStream).toHaveBeenCalledWith(
      "user-1",
      undefined,
      ["ORG BANANAS", "x".repeat(60)],
      expect.any(AbortSignal)
    );
  });

  it("accepts exactly the maximum of 40 items", async () => {
    serviceMock.startReceiptItemCategoryStream.mockResolvedValue(itemCategoryStreamOf([]));
    const items = Array.from({ length: 40 }, (_, index) => `Item ${index}`);

    const response = await postAsUser({ items });

    expect(response.status).toBe(200);
    expect(serviceMock.startReceiptItemCategoryStream).toHaveBeenCalledWith(
      "user-1",
      undefined,
      items,
      expect.any(AbortSignal)
    );
  });

  it("emits an SSE error event when the AI service is unavailable", async () => {
    serviceMock.startReceiptItemCategoryStream.mockRejectedValue(
      new AppError(503, "AI service unavailable")
    );

    const response = await postAsUser({ items: ["BANANAS"] });

    expect(response.status).toBe(200);
    expect(response.text).toBe('event: error\ndata: {"message":"AI service unavailable"}\n\n');
  });

  it.each([
    ["items is missing", {}],
    ["items is an empty array", { items: [] }],
    ["items is not an array", { items: "BANANAS" }],
    [
      "items exceeds the maximum of 40",
      { items: Array.from({ length: 41 }, (_, index) => `Item ${index}`) },
    ],
    ["an item is not a string", { items: ["BANANAS", 42] }],
    ["an item is blank", { items: ["BANANAS", "   "] }],
    ["the merchant is not a string", { merchant: 42, items: ["BANANAS"] }],
  ])("returns 400 before opening the stream when %s", async (_description, body) => {
    const response = await postAsUser(body);

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(serviceMock.startReceiptItemCategoryStream).not.toHaveBeenCalled();
  });
});
