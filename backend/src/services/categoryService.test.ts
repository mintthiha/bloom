import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, logActivityMock } = vi.hoisted(() => ({
  prismaMock: { $queryRaw: vi.fn() },
  logActivityMock: vi.fn(),
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: class {
      $queryRaw = prismaMock.$queryRaw;
    },
  };
});

vi.mock("./activityService", () => ({ logActivity: logActivityMock }));

/** Builds a raw Category row fixture. */
function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "cat-1",
    userId: "user-1",
    name: "Groceries",
    type: "EXPENSE",
    color: "#22c55e",
    icon: "🛒",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  prismaMock.$queryRaw.mockReset();
  logActivityMock.mockClear();
});

describe("listCategories", () => {
  it("seeds the default set for a user with no categories yet", async () => {
    const { listCategories } = await import("./categoryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([{ count: 0n }]).mockResolvedValue([]);

    await listCategories("user-1");

    // count check + 14 seed inserts + final select = 16 calls
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(16);
  });

  it("does not reseed when the user already has categories", async () => {
    const { listCategories } = await import("./categoryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([{ count: 3n }]).mockResolvedValueOnce([makeRow()]);

    const result = await listCategories("user-1");

    expect(result).toHaveLength(1);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe("createCategory", () => {
  it("rejects a blank name", async () => {
    const { createCategory } = await import("./categoryService");

    await expect(
      createCategory("user-1", { name: "  ", type: "EXPENSE", color: "#22c55e" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a name over the length limit", async () => {
    const { createCategory } = await import("./categoryService");

    await expect(
      createCategory("user-1", { name: "a".repeat(41), type: "EXPENSE", color: "#22c55e" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a non-hex color", async () => {
    const { createCategory } = await import("./categoryService");

    await expect(
      createCategory("user-1", { name: "Hobbies", type: "EXPENSE", color: "green" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an invalid type", async () => {
    const { createCategory } = await import("./categoryService");

    await expect(
      createCategory("user-1", {
        name: "Hobbies",
        type: "TRANSFER" as never,
        color: "#22c55e",
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an icon longer than the limit", async () => {
    const { createCategory } = await import("./categoryService");

    await expect(
      createCategory("user-1", {
        name: "Hobbies",
        type: "EXPENSE",
        color: "#22c55e",
        icon: "123456789",
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a duplicate name regardless of case", async () => {
    const { createCategory } = await import("./categoryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "cat-existing" }]);

    await expect(
      createCategory("user-1", { name: "groceries", type: "EXPENSE", color: "#22c55e" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("creates a category and logs the activity", async () => {
    const { createCategory } = await import("./categoryService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([]) // name-availability check
      .mockResolvedValueOnce([makeRow({ name: "Hobbies", icon: "🎨" })]); // insert

    const result = await createCategory("user-1", {
      name: "Hobbies",
      type: "EXPENSE",
      color: "#22c55e",
      icon: "🎨",
    });

    expect(result).toMatchObject({ name: "Hobbies", icon: "🎨" });
    expect(logActivityMock).toHaveBeenCalledWith(
      "user-1",
      "CATEGORY_CREATED",
      expect.stringContaining("Hobbies"),
      expect.any(Object)
    );
  });
});

describe("updateCategory", () => {
  it("throws 404 when the category does not belong to the user", async () => {
    const { updateCategory } = await import("./categoryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(
      updateCategory("user-1", "missing", { name: "Renamed", color: "#22c55e" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects renaming to a name already used by another category", async () => {
    const { updateCategory } = await import("./categoryService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeRow()]) // ownership check
      .mockResolvedValueOnce([{ id: "cat-other" }]); // name collision

    await expect(
      updateCategory("user-1", "cat-1", { name: "Dining", color: "#22c55e" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("allows keeping the same name unchanged (case-insensitive)", async () => {
    const { updateCategory } = await import("./categoryService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeRow()]) // ownership check
      .mockResolvedValueOnce([makeRow({ color: "#f97316" })]); // update

    const result = await updateCategory("user-1", "cat-1", {
      name: "groceries",
      color: "#f97316",
    });

    // No name-availability check runs since the name (case-insensitively) is unchanged.
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result.color).toBe("#f97316");
  });

  it("updates the category and logs the changed fields", async () => {
    const { updateCategory } = await import("./categoryService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeRow()]) // ownership check
      .mockResolvedValueOnce([]) // name-availability check
      .mockResolvedValueOnce([makeRow({ name: "Food", color: "#f97316" })]); // update

    const result = await updateCategory("user-1", "cat-1", { name: "Food", color: "#f97316" });

    expect(result).toMatchObject({ name: "Food", color: "#f97316" });
    expect(logActivityMock).toHaveBeenCalledWith(
      "user-1",
      "CATEGORY_UPDATED",
      expect.stringContaining("Groceries"),
      expect.any(Object)
    );
  });
});

describe("deleteCategory", () => {
  it("throws 404 when the category does not belong to the user", async () => {
    const { deleteCategory } = await import("./categoryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(deleteCategory("user-1", "missing")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("deletes the category and logs the activity", async () => {
    const { deleteCategory } = await import("./categoryService");
    prismaMock.$queryRaw
      .mockResolvedValueOnce([makeRow()]) // ownership check
      .mockResolvedValueOnce([]); // delete

    await deleteCategory("user-1", "cat-1");

    expect(logActivityMock).toHaveBeenCalledWith(
      "user-1",
      "CATEGORY_DELETED",
      expect.stringContaining("Groceries"),
      expect.any(Object)
    );
  });
});
