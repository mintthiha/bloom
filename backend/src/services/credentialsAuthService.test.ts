import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    credentialUser: { findUnique: vi.fn(), create: vi.fn() },
    rememberToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: class {
      credentialUser = prismaMock.credentialUser;
      rememberToken = prismaMock.rememberToken;
    },
  };
});

describe("credentialsAuthService", () => {
  beforeEach(() => {
    prismaMock.credentialUser.findUnique.mockReset();
    prismaMock.credentialUser.create.mockReset();
    prismaMock.rememberToken.create.mockReset();
    prismaMock.rememberToken.findUnique.mockReset();
    prismaMock.rememberToken.delete.mockReset();
    prismaMock.rememberToken.deleteMany.mockReset();
  });

  describe("issueRememberToken", () => {
    it("returns null when the password is wrong", async () => {
      const { issueRememberToken } = await import("./credentialsAuthService");
      prismaMock.credentialUser.findUnique.mockResolvedValue({
        id: "user-1",
        email: "jane@example.com",
        passwordHash: await bcrypt.hash("correct-password", 4),
      });

      const result = await issueRememberToken("jane@example.com", "wrong-password");

      expect(result).toBeNull();
      expect(prismaMock.rememberToken.create).not.toHaveBeenCalled();
    });

    it("returns null when the email is unknown", async () => {
      const { issueRememberToken } = await import("./credentialsAuthService");
      prismaMock.credentialUser.findUnique.mockResolvedValue(null);

      const result = await issueRememberToken("nobody@example.com", "whatever123");

      expect(result).toBeNull();
      expect(prismaMock.rememberToken.create).not.toHaveBeenCalled();
    });

    it("stores a hash of the token, never the raw token, and returns the raw token to the caller", async () => {
      const { issueRememberToken } = await import("./credentialsAuthService");
      prismaMock.credentialUser.findUnique.mockResolvedValue({
        id: "user-1",
        email: "jane@example.com",
        passwordHash: await bcrypt.hash("correct-password", 4),
      });
      prismaMock.rememberToken.create.mockResolvedValue({});

      const result = await issueRememberToken("jane@example.com", "correct-password");

      expect(result).toMatchObject({ id: "user-1", email: "jane@example.com" });
      expect(result?.token).toMatch(/^[0-9a-f]{64}$/);
      expect(result?.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const createArgs = prismaMock.rememberToken.create.mock.calls[0][0];
      expect(createArgs.data.userId).toBe("user-1");
      expect(createArgs.data.tokenHash).not.toBe(result?.token);
      expect(createArgs.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("verifyRememberToken", () => {
    it("returns null when the token is unknown", async () => {
      const { verifyRememberToken } = await import("./credentialsAuthService");
      prismaMock.rememberToken.findUnique.mockResolvedValue(null);

      const result = await verifyRememberToken("some-token");

      expect(result).toBeNull();
    });

    it("returns null and deletes the row when the token has expired", async () => {
      const { verifyRememberToken } = await import("./credentialsAuthService");
      prismaMock.rememberToken.findUnique.mockResolvedValue({
        id: "token-1",
        expiresAt: new Date(Date.now() - 1000),
        user: { id: "user-1", email: "jane@example.com" },
      });

      const result = await verifyRememberToken("expired-token");

      expect(result).toBeNull();
      expect(prismaMock.rememberToken.delete).toHaveBeenCalledWith({ where: { id: "token-1" } });
    });

    it("returns the user for a valid, unexpired token", async () => {
      const { verifyRememberToken } = await import("./credentialsAuthService");
      prismaMock.rememberToken.findUnique.mockResolvedValue({
        id: "token-1",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { id: "user-1", email: "jane@example.com" },
      });

      const result = await verifyRememberToken("valid-token");

      expect(result).toEqual({ id: "user-1", email: "jane@example.com" });
      expect(prismaMock.rememberToken.delete).not.toHaveBeenCalled();
    });
  });

  describe("revokeRememberToken", () => {
    it("deletes any row matching the token's hash", async () => {
      const { revokeRememberToken } = await import("./credentialsAuthService");
      prismaMock.rememberToken.deleteMany.mockResolvedValue({ count: 1 });

      await revokeRememberToken("some-token");

      expect(prismaMock.rememberToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
      });
    });
  });
});
