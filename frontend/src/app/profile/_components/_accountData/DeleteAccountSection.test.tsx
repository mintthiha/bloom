import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountSection } from "./DeleteAccountSection";

const { apiMock, signOutMock } = vi.hoisted(() => ({
  apiMock: { deleteUserAccount: vi.fn() },
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, deleteUserAccount: apiMock.deleteUserAccount } };
});

vi.mock("next-auth/react", () => ({ signOut: signOutMock }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteAccountSection", () => {
  it("does not delete anything until the confirm dialog is accepted", async () => {
    render(<DeleteAccountSection email="alex@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));

    expect(await screen.findByText("Delete alex@example.com?")).toBeInTheDocument();
    expect(apiMock.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("names the account generically when no email is known", async () => {
    render(<DeleteAccountSection email={null} />);

    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));

    expect(await screen.findByText("Delete your Bloom account?")).toBeInTheDocument();
  });

  it("erases the account, confirms with a toast, and signs the user out", async () => {
    apiMock.deleteUserAccount.mockResolvedValue(undefined);

    render(<DeleteAccountSection email="alex@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(apiMock.deleteUserAccount).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Account deleted");
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("keeps the user signed in and reports the failure when the delete fails", async () => {
    apiMock.deleteUserAccount.mockRejectedValue(new Error("nope"));

    render(<DeleteAccountSection email="alex@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't delete your account"));
    expect(signOutMock).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
