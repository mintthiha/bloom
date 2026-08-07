import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccount } from "./DeleteAccount";

const { apiMock, routerMock } = vi.hoisted(() => ({
  apiMock: { deleteAccount: vi.fn() },
  routerMock: { push: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, deleteAccount: apiMock.deleteAccount },
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeleteAccount", () => {
  it("reveals an inline confirmation before deleting", () => {
    render(<DeleteAccount accountId="a-1" displayName="My Chequing" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(apiMock.deleteAccount).not.toHaveBeenCalled();
  });

  it("cancels the confirmation without deleting", () => {
    render(<DeleteAccount accountId="a-1" displayName="My Chequing" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(apiMock.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes then redirects home with the encoded account name", async () => {
    apiMock.deleteAccount.mockResolvedValue({});
    render(<DeleteAccount accountId="a-1" displayName="My Chequing" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(apiMock.deleteAccount).toHaveBeenCalledWith("a-1"));
    expect(routerMock.push).toHaveBeenCalledWith("/?deleted=My%20Chequing");
  });

  it("returns to the confirm state and does not redirect when the delete fails", async () => {
    apiMock.deleteAccount.mockRejectedValue(new Error("nope"));
    render(<DeleteAccount accountId="a-1" displayName="My Chequing" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument());
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
