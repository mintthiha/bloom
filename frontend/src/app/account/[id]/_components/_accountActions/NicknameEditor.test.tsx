import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NicknameEditor } from "./NicknameEditor";
import type { Account } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { updateNickname: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, updateNickname: apiMock.updateNickname },
  };
});

/** Builds an updated Account fixture returned by the mocked API. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "a-1",
    ownerName: "Test",
    nickname: "Savings",
    accountType: "SAVINGS",
    balance: 0,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NicknameEditor", () => {
  it("shows the current nickname in read mode", () => {
    render(
      <NicknameEditor accountId="a-1" nickname="Vacation" onUpdated={vi.fn()} onError={vi.fn()} />
    );
    expect(screen.getByText("Vacation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Account nickname")).not.toBeInTheDocument();
  });

  it("shows a placeholder message when no nickname is set", () => {
    render(
      <NicknameEditor accountId="a-1" nickname={null} onUpdated={vi.fn()} onError={vi.fn()} />
    );
    expect(screen.getByText("No nickname set")).toBeInTheDocument();
  });

  it("enters edit mode pre-filled with the current nickname", () => {
    render(
      <NicknameEditor accountId="a-1" nickname="Vacation" onUpdated={vi.fn()} onError={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Account nickname")).toHaveValue("Vacation");
  });

  it("saves a trimmed nickname and notifies the parent", async () => {
    const updated = makeAccount({ nickname: "Rainy Day" });
    apiMock.updateNickname.mockResolvedValue(updated);
    const onUpdated = vi.fn();
    render(
      <NicknameEditor accountId="a-1" nickname={null} onUpdated={onUpdated} onError={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Account nickname"), {
      target: { value: "  Rainy Day  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(apiMock.updateNickname).toHaveBeenCalledWith("a-1", "Rainy Day");
  });

  it("sends undefined when the nickname is cleared to empty", async () => {
    apiMock.updateNickname.mockResolvedValue(makeAccount({ nickname: null }));
    render(<NicknameEditor accountId="a-1" nickname="Old" onUpdated={vi.fn()} onError={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Account nickname"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiMock.updateNickname).toHaveBeenCalledWith("a-1", undefined));
  });

  it("reports the error message when saving fails", async () => {
    apiMock.updateNickname.mockRejectedValue(new Error("Server exploded"));
    const onError = vi.fn();
    render(
      <NicknameEditor accountId="a-1" nickname={null} onUpdated={vi.fn()} onError={onError} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Account nickname"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Server exploded"));
  });

  it("cancels editing and returns to read mode without calling the API", () => {
    render(
      <NicknameEditor accountId="a-1" nickname="Keep" onUpdated={vi.fn()} onError={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Account nickname"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Keep")).toBeInTheDocument();
    expect(screen.queryByLabelText("Account nickname")).not.toBeInTheDocument();
    expect(apiMock.updateNickname).not.toHaveBeenCalled();
  });
});
