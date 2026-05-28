import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = prismaMock.$queryRaw;
  },
}));

describe("profileService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
  });

  it("rejects when first name is missing", async () => {
    const { upsertProfile } = await import("./profileService");

    await expect(
      upsertProfile("user-1", {
        firstName: "",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "First name is required" });
  });

  it("rejects when last name is missing", async () => {
    const { upsertProfile } = await import("./profileService");

    await expect(
      upsertProfile("user-1", {
        firstName: "Jane",
        lastName: "",
        username: "janedoe",
        email: "jane@example.com",
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "Last name is required" });
  });

  it("rejects usernames already used by another user", async () => {
    const { upsertProfile } = await import("./profileService");
    prismaMock.$queryRaw.mockResolvedValueOnce([{ userId: "other-user" }]);

    await expect(
      upsertProfile("user-1", {
        firstName: "Jane",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
      })
    ).rejects.toMatchObject({ statusCode: 409, message: "Username is already taken" });
  });

  it("creates or updates a profile and normalizes username/email casing", async () => {
    const { upsertProfile } = await import("./profileService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          userId: "user-1",
          firstName: "Jane",
          lastName: "Doe",
          username: "janedoe",
          email: "jane@example.com",
          tfsaBirthYear: null,
          tfsaRoomUsedElsewhere: null,
          rrspContributionRoom: null,
          createdAt: new Date("2026-04-04T00:00:00.000Z"),
          updatedAt: new Date("2026-04-04T00:00:00.000Z"),
        },
      ]);

    const result = await upsertProfile("user-1", {
      firstName: " Jane ",
      lastName: " Doe ",
      username: "JaneDoe",
      email: "JANE@EXAMPLE.COM",
    });

    expect(result).toMatchObject({
      userId: "user-1",
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      email: "jane@example.com",
    });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("rejects tfsaBirthYear before 1900", async () => {
    const { upsertProfile } = await import("./profileService");

    await expect(
      upsertProfile("user-1", {
        firstName: "Jane",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
        tfsaBirthYear: 1700,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects tfsaBirthYear after the current year", async () => {
    const { upsertProfile } = await import("./profileService");
    const futureYear = new Date().getFullYear() + 1;

    await expect(
      upsertProfile("user-1", {
        firstName: "Jane",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
        tfsaBirthYear: futureYear,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects negative tfsaRoomUsedElsewhere", async () => {
    const { upsertProfile } = await import("./profileService");

    await expect(
      upsertProfile("user-1", {
        firstName: "Jane",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
        tfsaRoomUsedElsewhere: -100,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "tfsaRoomUsedElsewhere must be at least 0" });
  });

  it("rejects negative rrspContributionRoom", async () => {
    const { upsertProfile } = await import("./profileService");

    await expect(
      upsertProfile("user-1", {
        firstName: "Jane",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
        rrspContributionRoom: -500,
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "rrspContributionRoom must be at least 0" });
  });

  it("accepts null values for all three contribution room fields", async () => {
    const { upsertProfile } = await import("./profileService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          userId: "user-1",
          firstName: "Jane",
          lastName: "Doe",
          username: "janedoe",
          email: "jane@example.com",
          tfsaBirthYear: null,
          tfsaRoomUsedElsewhere: null,
          rrspContributionRoom: null,
          createdAt: new Date("2026-04-04T00:00:00.000Z"),
          updatedAt: new Date("2026-04-04T00:00:00.000Z"),
        },
      ]);

    const result = await upsertProfile("user-1", {
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      email: "jane@example.com",
      tfsaBirthYear: null,
      tfsaRoomUsedElsewhere: null,
      rrspContributionRoom: null,
    });

    expect(result).toMatchObject({
      tfsaBirthYear: null,
      tfsaRoomUsedElsewhere: null,
      rrspContributionRoom: null,
    });
  });

  it("accepts valid contribution room values", async () => {
    const { upsertProfile } = await import("./profileService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          userId: "user-1",
          firstName: "Jane",
          lastName: "Doe",
          username: "janedoe",
          email: "jane@example.com",
          tfsaBirthYear: 1995,
          tfsaRoomUsedElsewhere: 5000,
          rrspContributionRoom: 14000,
          createdAt: new Date("2026-04-04T00:00:00.000Z"),
          updatedAt: new Date("2026-04-04T00:00:00.000Z"),
        },
      ]);

    const result = await upsertProfile("user-1", {
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      email: "jane@example.com",
      tfsaBirthYear: 1995,
      tfsaRoomUsedElsewhere: 5000,
      rrspContributionRoom: 14000,
    });

    expect(result).toMatchObject({
      tfsaBirthYear: 1995,
      tfsaRoomUsedElsewhere: 5000,
      rrspContributionRoom: 14000,
    });
  });
});
