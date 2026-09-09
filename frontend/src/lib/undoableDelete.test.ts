import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteWithUndo, UNDO_WINDOW_MS } from "./undoableDelete";

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteWithUndo", () => {
  it("removes, refreshes, then shows a 5s toast carrying an Undo action", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const restore = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn().mockResolvedValue(undefined);

    await deleteWithUndo({ entityLabel: "Budget", remove, restore, onChange });

    expect(remove).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith(
      "Budget deleted",
      expect.objectContaining({
        duration: UNDO_WINDOW_MS,
        action: expect.objectContaining({ label: "Undo" }),
      })
    );
  });

  it("runs restore + refresh + a confirmation toast when Undo is clicked", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const restore = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn().mockResolvedValue(undefined);

    await deleteWithUndo({ entityLabel: "Budget", remove, restore, onChange });
    const [, options] = toastMock.success.mock.calls[0];
    await options.action.onClick();

    expect(restore).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(toastMock.success).toHaveBeenLastCalledWith("Budget restored");
  });

  it("surfaces an error toast and rethrows when the delete fails", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("boom"));
    const restore = vi.fn();
    const onChange = vi.fn();

    await expect(
      deleteWithUndo({ entityLabel: "Budget", remove, restore, onChange })
    ).rejects.toThrow("boom");

    expect(toastMock.error).toHaveBeenCalledWith("boom");
    expect(onChange).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("reports a failed undo without throwing", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const restore = vi.fn().mockRejectedValue(new Error("gone"));
    const onChange = vi.fn().mockResolvedValue(undefined);

    await deleteWithUndo({ entityLabel: "Rule", remove, restore, onChange });
    const [, options] = toastMock.success.mock.calls[0];
    await options.action.onClick();

    expect(toastMock.error).toHaveBeenCalledWith("gone");
  });
});
