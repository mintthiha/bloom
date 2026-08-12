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
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
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
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "tfsaRoomUsedElsewhere must be at least 0",
    });
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
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "rrspContributionRoom must be at least 0",
    });
  });

  it("accepts null values for all three contribution room fields", async () => {
    const { upsertProfile } = await import("./profileService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
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
    prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
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

describe("getProfile", () => {
  it("returns null when the user has no profile", async () => {
    const { getProfile } = await import("./profileService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    const result = await getProfile("user-1");

    expect(result).toBeNull();
  });

  it("returns the normalized profile when one exists", async () => {
    const { getProfile } = await import("./profileService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        userId: "user-1",
        firstName: "Jane",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
        tfsaBirthYear: null,
        tfsaRoomUsedElsewhere: null,
        rrspContributionRoom: null,
        billRemindersEnabled: true,
        billReminderLeadDays: 3,
        createdAt: new Date("2026-04-04T00:00:00.000Z"),
        updatedAt: new Date("2026-04-04T00:00:00.000Z"),
      },
    ]);

    const result = await getProfile("user-1");

    expect(result).toMatchObject({
      userId: "user-1",
      firstName: "Jane",
      lastName: "Doe",
      username: "janedoe",
      email: "jane@example.com",
      billRemindersEnabled: true,
      billReminderLeadDays: 3,
    });
  });

  it("coerces Decimal string fields to numbers in the returned profile", async () => {
    const { getProfile } = await import("./profileService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        userId: "user-1",
        firstName: "Jane",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
        tfsaBirthYear: 1990,
        tfsaRoomUsedElsewhere: "5000.00",
        rrspContributionRoom: "14000.50",
        billRemindersEnabled: false,
        billReminderLeadDays: 3,
        createdAt: new Date("2026-04-04T00:00:00.000Z"),
        updatedAt: new Date("2026-04-04T00:00:00.000Z"),
      },
    ]);

    const result = await getProfile("user-1");

    expect(typeof result!.tfsaRoomUsedElsewhere).toBe("number");
    expect(result!.tfsaRoomUsedElsewhere).toBe(5000);
    expect(typeof result!.rrspContributionRoom).toBe("number");
    expect(result!.rrspContributionRoom).toBe(14000.5);
  });
});

describe("updateReminderPreferences", () => {
  it("rejects a non-integer billReminderLeadDays", async () => {
    const { updateReminderPreferences } = await import("./profileService");

    await expect(
      updateReminderPreferences("user-1", { billReminderLeadDays: 1.5 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects billReminderLeadDays exceeding 30", async () => {
    const { updateReminderPreferences } = await import("./profileService");

    await expect(
      updateReminderPreferences("user-1", { billReminderLeadDays: 31 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects negative billReminderLeadDays", async () => {
    const { updateReminderPreferences } = await import("./profileService");

    await expect(
      updateReminderPreferences("user-1", { billReminderLeadDays: -1 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when the profile does not exist", async () => {
    const { updateReminderPreferences } = await import("./profileService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(
      updateReminderPreferences("user-1", { billRemindersEnabled: true })
    ).rejects.toMatchObject({ statusCode: 404, message: "Profile not found" });
  });

  it("updates reminder preferences and returns the updated profile", async () => {
    const { updateReminderPreferences } = await import("./profileService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        userId: "user-1",
        firstName: "Jane",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
        tfsaBirthYear: null,
        tfsaRoomUsedElsewhere: null,
        rrspContributionRoom: null,
        billRemindersEnabled: true,
        billReminderLeadDays: 5,
        createdAt: new Date("2026-04-04T00:00:00.000Z"),
        updatedAt: new Date("2026-04-08T00:00:00.000Z"),
      },
    ]);

    const result = await updateReminderPreferences("user-1", {
      billRemindersEnabled: true,
      billReminderLeadDays: 5,
    });

    expect(result).toMatchObject({
      billRemindersEnabled: true,
      billReminderLeadDays: 5,
    });
  });

  it("accepts billReminderLeadDays of 0 (no lead)", async () => {
    const { updateReminderPreferences } = await import("./profileService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        userId: "user-1",
        firstName: "Jane",
        lastName: "Doe",
        username: "janedoe",
        email: "jane@example.com",
        tfsaBirthYear: null,
        tfsaRoomUsedElsewhere: null,
        rrspContributionRoom: null,
        billRemindersEnabled: false,
        billReminderLeadDays: 0,
        createdAt: new Date("2026-04-04T00:00:00.000Z"),
        updatedAt: new Date("2026-04-08T00:00:00.000Z"),
      },
    ]);

    const result = await updateReminderPreferences("user-1", { billReminderLeadDays: 0 });

    expect(result.billReminderLeadDays).toBe(0);
  });
});
