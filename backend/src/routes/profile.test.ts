import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    getProfile: vi.fn(),
    upsertProfile: vi.fn(),
  },
}));

vi.mock("../services/profileService", () => serviceMock);

describe("profile routes", () => {
  beforeEach(() => {
    serviceMock.getProfile.mockReset();
    serviceMock.upsertProfile.mockReset();
  });

  it("returns 401 when x-user-id is missing", async () => {
    const response = await request(app).get("/api/profile");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("returns the current profile on GET /api/profile", async () => {
    serviceMock.getProfile.mockResolvedValue({
      userId: "user-1",
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      email: "jane@example.com",
    });

    const response = await request(app)
      .get("/api/profile")
      .set("X-User-Id", "user-1");

    expect(response.status).toBe(200);
    expect(serviceMock.getProfile).toHaveBeenCalledWith("user-1");
    expect(response.body).toMatchObject({ username: "janedoe" });
  });

  it("creates or updates the current profile on PUT /api/profile", async () => {
    serviceMock.upsertProfile.mockResolvedValue({
      userId: "user-1",
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      email: "jane@example.com",
    });

    const payload = {
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      email: "jane@example.com",
    };

    const response = await request(app)
      .put("/api/profile")
      .set("X-User-Id", "user-1")
      .send(payload);

    expect(response.status).toBe(200);
    expect(serviceMock.upsertProfile).toHaveBeenCalledWith("user-1", payload);
    expect(response.body).toMatchObject({ firstName: "Jane", username: "janedoe" });
  });
});
