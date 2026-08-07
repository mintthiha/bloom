import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FreezeButton } from "./FreezeButton";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    freeze: vi.fn(),
    unfreeze: vi.fn(),
  },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { ...actual.api, freeze: apiMock.freeze, unfreeze: apiMock.unfreeze },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FreezeButton", () => {
  it("labels the button 'Freeze' when the account is active", () => {
    render(<FreezeButton accountId="a-1" frozen={false} onToggled={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("Freeze");
  });

  it("labels the button 'Unfreeze' when the account is frozen", () => {
    render(<FreezeButton accountId="a-1" frozen={true} onToggled={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("Unfreeze");
  });

  it("calls freeze then notifies the parent when active", async () => {
    apiMock.freeze.mockResolvedValue({});
    const onToggled = vi.fn();
    render(<FreezeButton accountId="a-1" frozen={false} onToggled={onToggled} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onToggled).toHaveBeenCalledTimes(1));
    expect(apiMock.freeze).toHaveBeenCalledWith("a-1");
    expect(apiMock.unfreeze).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Account frozen");
  });

  it("calls unfreeze when the account is frozen", async () => {
    apiMock.unfreeze.mockResolvedValue({});
    const onToggled = vi.fn();
    render(<FreezeButton accountId="a-1" frozen={true} onToggled={onToggled} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onToggled).toHaveBeenCalledTimes(1));
    expect(apiMock.unfreeze).toHaveBeenCalledWith("a-1");
    expect(apiMock.freeze).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Account unfrozen");
  });

  it("disables the button while the toggle is in flight", async () => {
    let resolveFreeze: (value: unknown) => void = () => {};
    apiMock.freeze.mockReturnValue(new Promise((resolve) => (resolveFreeze = resolve)));
    render(<FreezeButton accountId="a-1" frozen={false} onToggled={vi.fn()} />);

    fireEvent.click(screen.getByRole("button"));
    // Mid-flight: disabled and showing the loading ellipsis.
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    expect(screen.getByRole("button")).toHaveTextContent("…");

    resolveFreeze({});
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });

  it("shows an error toast and does not notify the parent when the toggle fails", async () => {
    apiMock.freeze.mockRejectedValue(new Error("Account is locked"));
    const onToggled = vi.fn();
    render(<FreezeButton accountId="a-1" frozen={false} onToggled={onToggled} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Account is locked"));
    expect(onToggled).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    // Button re-enables via the finally block so the user can retry.
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    apiMock.unfreeze.mockRejectedValue("network blip");
    render(<FreezeButton accountId="a-1" frozen={true} onToggled={vi.fn()} />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to update account"));
  });
});
