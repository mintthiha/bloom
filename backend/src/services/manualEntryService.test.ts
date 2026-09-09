import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
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

describe("manualEntryService", () => {
  beforeEach(() => {
    prismaMock.$queryRaw.mockReset();
  });

  it("lists only live (non-soft-deleted) entries", async () => {
    const { listManualEntries } = await import("./manualEntryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      {
        id: "e-1",
        userId: "u-1",
        name: "Car",
        type: "ASSET",
        amount: "5000",
        date: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ]);

    const rows = await listManualEntries("u-1");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "e-1", amount: 5000 });
    const sql = String(prismaMock.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('"deletedAt" IS NULL');
  });

  it("soft-deletes an entry and returns its name and type", async () => {
    const { deleteManualEntry } = await import("./manualEntryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "e-1", name: "Car", type: "ASSET" }]);

    await expect(deleteManualEntry("u-1", "e-1")).resolves.toEqual({ name: "Car", type: "ASSET" });
    const sql = String(prismaMock.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('SET "deletedAt" = CURRENT_TIMESTAMP');
  });

  it("throws 404 when deleting an entry that is missing or already deleted", async () => {
    const { deleteManualEntry } = await import("./manualEntryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(deleteManualEntry("u-1", "e-9")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("restores a soft-deleted entry", async () => {
    const { restoreManualEntry } = await import("./manualEntryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: "e-1", name: "Car", type: "ASSET" }]);

    await expect(restoreManualEntry("u-1", "e-1")).resolves.toEqual({ name: "Car", type: "ASSET" });
    const sql = String(prismaMock.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('SET "deletedAt" = NULL');
  });

  it("throws 404 when restoring an entry that is not currently deleted", async () => {
    const { restoreManualEntry } = await import("./manualEntryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(restoreManualEntry("u-1", "e-9")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("excludes soft-deleted entries from the net-worth totals", async () => {
    const { getManualEntryTotals } = await import("./manualEntryService");
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { type: "ASSET", total: "5000" },
      { type: "LIABILITY", total: "1200" },
    ]);

    const totals = await getManualEntryTotals("u-1");

    expect(totals).toEqual({ manualAssets: 5000, manualLiabilities: 1200 });
    const sql = String(prismaMock.$queryRaw.mock.calls[0][0]);
    expect(sql).toContain('"deletedAt" IS NULL');
  });
});
