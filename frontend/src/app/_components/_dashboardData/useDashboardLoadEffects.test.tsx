import { StrictMode, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountDeletedToast } from "./useDashboardLoadEffects";

const { toastMock, replaceMock, apiMock, searchParamsState } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() },
  replaceMock: vi.fn(),
  apiMock: { restoreAccount: vi.fn() },
  searchParamsState: { current: new URLSearchParams() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParamsState.current,
}));
vi.mock("@/lib/api", () => ({ api: apiMock }));

/** Renders inside React's StrictMode, which Next.js enables in development. */
function strictWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsState.current = new URLSearchParams("deleted=Everyday%20Chequing&deletedId=acc-1");
});

describe("useAccountDeletedToast", () => {
  it("shows one deletion toast with Undo and cleans the URL", async () => {
    renderHook(() => useAccountDeletedToast(vi.fn()), { wrapper: strictWrapper });

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(toastMock.success).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith(
      "Everyday Chequing deleted",
      expect.objectContaining({
        id: "account-deleted-acc-1",
        action: expect.objectContaining({ label: "Undo" }),
      })
    );
  });

  it("skips a repeat run for the same deletion, as StrictMode causes in development", () => {
    const { rerender } = renderHook(() => useAccountDeletedToast(vi.fn()));
    // A fresh params object with the same values re-runs the effect, like StrictMode's second pass.
    searchParamsState.current = new URLSearchParams("deleted=Everyday%20Chequing&deletedId=acc-1");

    rerender();

    expect(toastMock.success).toHaveBeenCalledTimes(1);
  });

  it("reuses one toast id when the dashboard remounts before the URL is cleaned", () => {
    renderHook(() => useAccountDeletedToast(vi.fn())).unmount();
    renderHook(() => useAccountDeletedToast(vi.fn()));

    // sonner replaces a toast that has the same id, so the user still sees exactly one.
    const toastIds = toastMock.success.mock.calls.map(([, options]) => options?.id);
    expect(toastIds).toEqual(["account-deleted-acc-1", "account-deleted-acc-1"]);
  });

  it("toasts again for a later deletion once the URL has been cleaned", () => {
    const { rerender } = renderHook(() => useAccountDeletedToast(vi.fn()));
    searchParamsState.current = new URLSearchParams();
    rerender();
    searchParamsState.current = new URLSearchParams("deleted=Everyday%20Chequing&deletedId=acc-1");

    rerender();

    expect(toastMock.success).toHaveBeenCalledTimes(2);
  });

  it("restores the account, reloads, and confirms when Undo is clicked", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    apiMock.restoreAccount.mockResolvedValue({});
    renderHook(() => useAccountDeletedToast(reload));
    const options = toastMock.success.mock.calls[0][1] as {
      action: { onClick: () => Promise<void> };
    };

    await options.action.onClick();

    expect(apiMock.restoreAccount).toHaveBeenCalledWith("acc-1");
    expect(reload).toHaveBeenCalledOnce();
    expect(toastMock.success).toHaveBeenLastCalledWith("Everyday Chequing restored");
  });

  it("explains a failed undo instead of claiming success", async () => {
    apiMock.restoreAccount.mockRejectedValue(new Error("Account not found"));
    renderHook(() => useAccountDeletedToast(vi.fn()));
    const options = toastMock.success.mock.calls[0][1] as {
      action: { onClick: () => Promise<void> };
    };

    await options.action.onClick();

    expect(toastMock.error).toHaveBeenCalledWith("Account not found");
  });

  it("shows a plain toast without Undo when no account id came back", () => {
    searchParamsState.current = new URLSearchParams("deleted=Old%20Card");

    renderHook(() => useAccountDeletedToast(vi.fn()));

    expect(toastMock.success).toHaveBeenCalledWith("Old Card deleted", {
      id: "account-deleted-Old Card",
    });
  });

  it("does nothing on a normal visit", () => {
    searchParamsState.current = new URLSearchParams();

    renderHook(() => useAccountDeletedToast(vi.fn()));

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
