import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { AppError } from "../middleware/errorHandler";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: { draftTransactionFromNote: vi.fn() },
}));

vi.mock("../services/quickAddService", () => serviceMock);

const DRAFT = {
  direction: "EXPENSE",
  amount: 4.5,
  merchant: "Tim Hortons",
  category: "Dining",
  date: "2026-10-16",
};

/** Posts a note to the quick-add endpoint as the Next.js proxy would for a signed-in user. */
function postNote(body: unknown) {
  return request(app)
    .post("/api/quick-add/draft")
    .set("X-Internal-Secret", INTERNAL_SECRET)
    .set("X-User-Id", "user-1")
    .send(body as object);
}

beforeEach(() => {
  serviceMock.draftTransactionFromNote.mockReset();
});

describe("quick-add draft route", () => {
  it("returns the draft read from the note, for the user's own today", async () => {
    serviceMock.draftTransactionFromNote.mockResolvedValue(DRAFT);

    const response = await postNote({
      note: "  Coffee 4.50 at Tim's yesterday ",
      today: "2026-10-17",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ draft: DRAFT });
    expect(serviceMock.draftTransactionFromNote).toHaveBeenCalledWith(
      "user-1",
      "Coffee 4.50 at Tim's yesterday",
      "2026-10-17"
    );
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app)
      .post("/api/quick-add/draft")
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ note: "coffee 4", today: "2026-10-17" });

    expect(response.status).toBe(401);
    expect(serviceMock.draftTransactionFromNote).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing note", { today: "2026-10-17" }, "note must be a string"],
    ["a blank note", { note: "   ", today: "2026-10-17" }, "note is required"],
    [
      "a note over 200 characters",
      { note: "x".repeat(201), today: "2026-10-17" },
      "note must be at most 200 characters",
    ],
    ["a missing today", { note: "coffee 4" }, "today must be a string"],
    [
      "a today that isn't a date",
      { note: "coffee 4", today: "2026-02-30" },
      "today must be a YYYY-MM-DD date",
    ],
  ])("rejects %s before calling the service", async (_, body, error) => {
    const response = await postNote(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error });
    expect(serviceMock.draftTransactionFromNote).not.toHaveBeenCalled();
  });

  it("passes on an unavailable model as 503", async () => {
    serviceMock.draftTransactionFromNote.mockRejectedValue(
      new AppError(503, "AI service unavailable")
    );

    const response = await postNote({ note: "coffee 4", today: "2026-10-17" });

    expect(response.status).toBe(503);
  });
});
