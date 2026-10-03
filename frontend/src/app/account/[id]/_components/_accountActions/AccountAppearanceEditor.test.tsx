import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountAppearanceEditor } from "./AccountAppearanceEditor";
import type { Account } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { updateAccountAppearance: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, updateAccountAppearance: apiMock.updateAccountAppearance },
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
    color: null,
    icon: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AccountAppearanceEditor", () => {
  it("marks the account's saved colour as selected", () => {
    render(
      <AccountAppearanceEditor
        accountId="a-1"
        color="BLUE"
        icon={null}
        onUpdated={vi.fn()}
        onError={vi.fn()}
      />
    );
    expect(screen.getByRole("radio", { name: "Blue" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Amber" })).toHaveAttribute("aria-checked", "false");
  });

  it("saves the picked colour and notifies the parent", async () => {
    const updated = makeAccount({ color: "VIOLET" });
    apiMock.updateAccountAppearance.mockResolvedValue(updated);
    const onUpdated = vi.fn();
    render(
      <AccountAppearanceEditor
        accountId="a-1"
        color={null}
        icon={null}
        onUpdated={onUpdated}
        onError={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Violet" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(apiMock.updateAccountAppearance).toHaveBeenCalledWith("a-1", {
      color: "VIOLET",
      icon: null,
    });
  });

  it("clears the colour when the selected swatch is clicked again", async () => {
    apiMock.updateAccountAppearance.mockResolvedValue(makeAccount({ color: null }));
    render(
      <AccountAppearanceEditor
        accountId="a-1"
        color="BLUE"
        icon={null}
        onUpdated={vi.fn()}
        onError={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Blue" }));

    await waitFor(() =>
      expect(apiMock.updateAccountAppearance).toHaveBeenCalledWith("a-1", {
        color: null,
        icon: null,
      })
    );
  });

  it("saves the picked icon alongside the current colour", async () => {
    apiMock.updateAccountAppearance.mockResolvedValue(makeAccount({ icon: "🏦" }));
    render(
      <AccountAppearanceEditor
        accountId="a-1"
        color="GREEN"
        icon={null}
        onUpdated={vi.fn()}
        onError={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Icon 🏦" }));

    await waitFor(() =>
      expect(apiMock.updateAccountAppearance).toHaveBeenCalledWith("a-1", {
        color: "GREEN",
        icon: "🏦",
      })
    );
  });

  it("reports the error message when saving fails", async () => {
    apiMock.updateAccountAppearance.mockRejectedValue(new Error("Server exploded"));
    const onError = vi.fn();
    render(
      <AccountAppearanceEditor
        accountId="a-1"
        color={null}
        icon={null}
        onUpdated={vi.fn()}
        onError={onError}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Amber" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Server exploded"));
  });
});
