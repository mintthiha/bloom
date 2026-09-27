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
  signOutMock.mockResolvedValue(undefined);
  localStorage.clear();
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

  it("clears the preferences this browser cached for the deleted account", async () => {
    apiMock.deleteUserAccount.mockResolvedValue(undefined);
    localStorage.setItem("bloom_dashboard_card_order", "stale");
    localStorage.setItem("bloom_saved_account", '{"token":"t","email":"alex@example.com"}');
    localStorage.setItem("bloom_active_user", "u-1");

    render(<DeleteAccountSection email="alex@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(localStorage.getItem("bloom_dashboard_card_order")).toBeNull();
    expect(localStorage.getItem("bloom_saved_account")).toBeNull();
    expect(localStorage.getItem("bloom_active_user")).toBeNull();
  });

  it("says the data is gone but sign-out failed when only the sign-out throws", async () => {
    apiMock.deleteUserAccount.mockResolvedValue(undefined);
    signOutMock.mockRejectedValue(new Error("offline"));

    render(<DeleteAccountSection email="alex@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Your data is deleted, but signing out failed — please sign out manually."
      )
    );
    expect(toast.success).toHaveBeenCalledWith("Account deleted");
    expect(toast.error).not.toHaveBeenCalledWith("Couldn't delete your account");
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
