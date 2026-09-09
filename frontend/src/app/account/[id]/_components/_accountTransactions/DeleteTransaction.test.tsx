import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteTransaction } from "./DeleteTransaction";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { deleteTransaction: vi.fn(), restoreTransaction: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      deleteTransaction: apiMock.deleteTransaction,
      restoreTransaction: apiMock.restoreTransaction,
    },
  };
});

vi.mock("sonner", () => ({ toast: toastMock }));

/** Renders DeleteTransaction with default props, overriding only what a test needs. */
function renderDialog(overrides: Partial<React.ComponentProps<typeof DeleteTransaction>> = {}) {
  const props = {
    accountId: "a-1",
    pendingTransactionId: "t-1" as string | null,
    onPendingChange: vi.fn(),
    deletingTransactionId: null as string | null,
    onDeletingChange: vi.fn(),
    editingTransactionId: null as string | null,
    onCancelEditing: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<DeleteTransaction {...props} />) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteTransaction", () => {
  it("does not render the dialog when no transaction is pending", () => {
    renderDialog({ pendingTransactionId: null });
    expect(screen.queryByText("Delete transaction?")).not.toBeInTheDocument();
  });

  it("shows the confirmation dialog when a transaction is pending", () => {
    renderDialog();
    expect(screen.getByText("Delete transaction?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("deletes the pending transaction, refreshes, and shows an undo toast", async () => {
    apiMock.deleteTransaction.mockResolvedValue({});
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(props.onChange).toHaveBeenCalledTimes(1));
    expect(apiMock.deleteTransaction).toHaveBeenCalledWith("a-1", "t-1");
    expect(toastMock.success).toHaveBeenCalledWith(
      "Transaction deleted",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) })
    );
    // finally block resets both pending and deleting markers.
    expect(props.onDeletingChange).toHaveBeenCalledWith("t-1");
    expect(props.onDeletingChange).toHaveBeenLastCalledWith(null);
    expect(props.onPendingChange).toHaveBeenCalledWith(null);
  });

  it("restores the transaction when the undo action is invoked", async () => {
    apiMock.deleteTransaction.mockResolvedValue({});
    apiMock.restoreTransaction.mockResolvedValue({});
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());

    const [, options] = toastMock.success.mock.calls[0];
    await options.action.onClick();

    expect(apiMock.restoreTransaction).toHaveBeenCalledWith("a-1", "t-1");
    expect(props.onChange).toHaveBeenCalledTimes(2);
    expect(toastMock.success).toHaveBeenLastCalledWith("Transaction restored");
  });

  it("cancels an active edit only when it targets the deleted transaction", async () => {
    apiMock.deleteTransaction.mockResolvedValue({});
    const { props } = renderDialog({ editingTransactionId: "t-1" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(props.onCancelEditing).toHaveBeenCalledTimes(1));
  });

  it("leaves an unrelated edit untouched", async () => {
    apiMock.deleteTransaction.mockResolvedValue({});
    const { props } = renderDialog({ editingTransactionId: "t-other" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(props.onChange).toHaveBeenCalled());
    expect(props.onCancelEditing).not.toHaveBeenCalled();
  });

  it("reports the error and does not refresh when the delete fails", async () => {
    apiMock.deleteTransaction.mockRejectedValue(new Error("Replay failed"));
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Replay failed"));
    expect(props.onChange).not.toHaveBeenCalled();
    // Markers are still reset in the finally block.
    expect(props.onDeletingChange).toHaveBeenLastCalledWith(null);
    expect(props.onPendingChange).toHaveBeenCalledWith(null);
  });

  it("cancels without calling the API", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(apiMock.deleteTransaction).not.toHaveBeenCalled();
    expect(props.onPendingChange).toHaveBeenCalledWith(null);
  });

  it("shows a deleting state and disables the actions while in flight", () => {
    renderDialog({ deletingTransactionId: "t-1" });
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
