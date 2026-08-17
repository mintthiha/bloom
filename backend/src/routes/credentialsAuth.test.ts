import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { INTERNAL_SECRET } from "../test-setup";

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    registerUser: vi.fn(),
    verifyCredentials: vi.fn(),
    issueRememberToken: vi.fn(),
    verifyRememberToken: vi.fn(),
    revokeRememberToken: vi.fn(),
  },
}));

vi.mock("../services/credentialsAuthService", () => serviceMock);

describe("credentials-auth routes", () => {
  beforeEach(() => {
    serviceMock.registerUser.mockReset();
    serviceMock.verifyCredentials.mockReset();
    serviceMock.issueRememberToken.mockReset();
    serviceMock.verifyRememberToken.mockReset();
    serviceMock.revokeRememberToken.mockReset();
  });

  describe("POST /remember/issue", () => {
    it("returns 200 with the issued token on valid credentials", async () => {
      const expiresAt = new Date();
      serviceMock.issueRememberToken.mockResolvedValue({
        id: "user-1",
        email: "jane@example.com",
        token: "raw-token",
        expiresAt,
      });

      const response = await request(app)
        .post("/api/credentials-auth/remember/issue")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .send({ email: "Jane@Example.com", password: "correct-password" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: "user-1",
        email: "jane@example.com",
        token: "raw-token",
      });
      expect(serviceMock.issueRememberToken).toHaveBeenCalledWith(
        "jane@example.com",
        "correct-password"
      );
    });

    it("returns 401 when credentials are invalid", async () => {
      serviceMock.issueRememberToken.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/credentials-auth/remember/issue")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .send({ email: "jane@example.com", password: "wrong-password" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Invalid email or password" });
    });

    it("rejects a missing password before calling the service", async () => {
      const response = await request(app)
        .post("/api/credentials-auth/remember/issue")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .send({ email: "jane@example.com" });

      expect(response.status).toBe(400);
      expect(serviceMock.issueRememberToken).not.toHaveBeenCalled();
    });
  });

  describe("POST /remember/verify", () => {
    it("returns 200 with the user for a valid token", async () => {
      serviceMock.verifyRememberToken.mockResolvedValue({
        id: "user-1",
        email: "jane@example.com",
      });

      const response = await request(app)
        .post("/api/credentials-auth/remember/verify")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .send({ token: "raw-token" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: "user-1", email: "jane@example.com" });
      expect(serviceMock.verifyRememberToken).toHaveBeenCalledWith("raw-token");
    });

    it("returns 401 for an unknown or expired token", async () => {
      serviceMock.verifyRememberToken.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/credentials-auth/remember/verify")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .send({ token: "stale-token" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Saved sign-in has expired" });
    });
  });

  describe("DELETE /remember", () => {
    it("revokes the token and returns 204", async () => {
      serviceMock.revokeRememberToken.mockResolvedValue(undefined);

      const response = await request(app)
        .delete("/api/credentials-auth/remember")
        .set("X-Internal-Secret", INTERNAL_SECRET)
        .send({ token: "raw-token" });

      expect(response.status).toBe(204);
      expect(serviceMock.revokeRememberToken).toHaveBeenCalledWith("raw-token");
    });
  });
});
