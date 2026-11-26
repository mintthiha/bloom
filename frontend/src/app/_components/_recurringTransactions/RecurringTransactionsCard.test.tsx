import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecurringTransaction } from "@/lib/api";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: { skipMissedRecurringTransaction: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { RecurringTransactionsCard } from "./RecurringTransactionsCard";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

/** Builds an active weekly $100 rule whose next run is the given number of days from now. */
function makeWeeklyRule(id: string, name: string, daysFromNow: number): RecurringTransaction {
  return {
    id,
    userId: "user-1",
    accountId: "account-1",
    name,
    type: "WITHDRAWAL",
    amount: 100,
    category: null,
    merchant: null,
    description: null,
    frequency: "WEEKLY",
    startDate: new Date(Date.now() + daysFromNow * DAY_IN_MILLISECONDS).toISOString(),
    endDate: null,
    nextRunAt: new Date(Date.now() + daysFromNow * DAY_IN_MILLISECONDS).toISOString(),
    lastRunAt: null,
    active: true,
    createdAt: "",
    updatedAt: "",
    accountOwnerName: "Test Owner",
    accountNickname: "Main",
    accountType: "CHEQUING",
  } as RecurringTransaction;
}

describe("RecurringTransactionsCard â€” skip missed", () => {
  beforeEach(() => {
    apiMock.skipMissedRecurringTransaction.mockReset();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it("only offers Skip missed on rules that are due", () => {
    render(
      <RecurringTransactionsCard
        rules={[makeWeeklyRule("due", "Gym", -10), makeWeeklyRule("upcoming", "Phone", 3)]}
        accounts={[]}
        onChanged={vi.fn()}
      />
    );

    expect(screen.getAllByRole("button", { name: "Skip missed" })).toHaveLength(1);
  });

  it("confirms with the missed count, then skips, toasts, and refreshes", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    apiMock.skipMissedRecurringTransaction.mockResolvedValue({
      recurring: makeWeeklyRule("due", "Gym", 4),
      skippedCount: 2,
    });
    render(
      <RecurringTransactionsCard
        rules={[makeWeeklyRule("due", "Gym", -10)]}
        accounts={[]}
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip missed" }));

    // Due 10 and 3 days ago; the next one is 4 days out.
    expect(await screen.findByText('Skip 2 missed payments for "Gym"?')).toBeInTheDocument();
    expect(
      screen.getByText(/won't be recorded, and no account balance changes/)
    ).toBeInTheDocument();
    expect(apiMock.skipMissedRecurringTransaction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Skip payments" }));

    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Skipped 2 missed payments for "Gym"')
    );
    expect(apiMock.skipMissedRecurringTransaction).toHaveBeenCalledWith("due");
    expect(onChanged).toHaveBeenCalled();
  });

  it("toasts the API error when the skip fails", async () => {
    apiMock.skipMissedRecurringTransaction.mockRejectedValue(
      new Error('"Gym" has no missed payments to skip')
    );
    render(
      <RecurringTransactionsCard
        rules={[makeWeeklyRule("due", "Gym", -10)]}
        accounts={[]}
        onChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip missed" }));
    fireEvent.click(await screen.findByRole("button", { name: "Skip payments" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith('"Gym" has no missed payments to skip')
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("does nothing when the confirm is cancelled", async () => {
    render(
      <RecurringTransactionsCard
        rules={[makeWeeklyRule("due", "Gym", -10)]}
        accounts={[]}
        onChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip missed" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(apiMock.skipMissedRecurringTransaction).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText('Skip 2 missed payments for "Gym"?')).not.toBeInTheDocument()
    );
  });
});
