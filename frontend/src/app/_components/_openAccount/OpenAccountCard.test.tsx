import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAccountCard } from "./OpenAccountCard";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { createAccount: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, createAccount: apiMock.createAccount },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OpenAccountCard", () => {
  it("disables the Open button until an account holder name is entered", () => {
    render(<OpenAccountCard onCreated={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Account holder name"), {
      target: { value: "Alex" },
    });
    expect(screen.getByRole("button", { name: "Open" })).toBeEnabled();
  });

  it("creates an account with the trimmed name and no nickname, then resets and toasts", async () => {
    apiMock.createAccount.mockResolvedValue({ id: "acct-new" });
    const onCreated = vi.fn().mockResolvedValue(undefined);
    render(<OpenAccountCard onCreated={onCreated} />);

    const ownerInput = screen.getByPlaceholderText("Account holder name");
    fireEvent.change(ownerInput, { target: { value: "  Alex Owner  " } });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("acct-new"));
    expect(apiMock.createAccount).toHaveBeenCalledWith("Alex Owner", "CHEQUING", undefined);
    expect(toast.success).toHaveBeenCalledWith("Account opened");
    expect(ownerInput).toHaveValue("");
  });

  it("passes the nickname and selected account type through", async () => {
    apiMock.createAccount.mockResolvedValue({ id: "acct-2" });
    render(<OpenAccountCard onCreated={vi.fn().mockResolvedValue(undefined)} />);

    fireEvent.change(screen.getByPlaceholderText("Account holder name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByPlaceholderText("Account nickname"), {
      target: { value: "Rainy Day" },
    });
    fireEvent.change(screen.getByLabelText("Account type"), { target: { value: "TFSA" } });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() =>
      expect(apiMock.createAccount).toHaveBeenCalledWith("Sam", "TFSA", "Rainy Day")
    );
  });

  it("shows an inline error and does not toast when creation fails", async () => {
    apiMock.createAccount.mockRejectedValue(new Error("Name already taken"));
    render(<OpenAccountCard onCreated={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Account holder name"), {
      target: { value: "Dup" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => expect(screen.getByText("Name already taken")).toBeInTheDocument());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
