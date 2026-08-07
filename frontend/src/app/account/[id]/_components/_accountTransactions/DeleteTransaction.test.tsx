import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteTransaction } from "./DeleteTransaction";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { deleteTransaction: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, deleteTransaction: apiMock.deleteTransaction },
  };
});

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
    onDeleted: vi.fn(),
    onError: vi.fn(),
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

  it("deletes the pending transaction and notifies the parent", async () => {
    apiMock.deleteTransaction.mockResolvedValue({});
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledTimes(1));
    expect(apiMock.deleteTransaction).toHaveBeenCalledWith("a-1", "t-1");
    // finally block resets both pending and deleting markers.
    expect(props.onDeletingChange).toHaveBeenCalledWith("t-1");
    expect(props.onDeletingChange).toHaveBeenLastCalledWith(null);
    expect(props.onPendingChange).toHaveBeenCalledWith(null);
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

    await waitFor(() => expect(props.onDeleted).toHaveBeenCalled());
    expect(props.onCancelEditing).not.toHaveBeenCalled();
  });

  it("reports the error and does not notify success when the delete fails", async () => {
    apiMock.deleteTransaction.mockRejectedValue(new Error("Replay failed"));
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(props.onError).toHaveBeenCalledWith("Replay failed"));
    expect(props.onDeleted).not.toHaveBeenCalled();
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
