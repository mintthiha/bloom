import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportCsvButton } from "./ExportCsvButton";
import type { Account, Transaction } from "@/lib/api";

vi.mock("./export-csv", () => ({
  transactionsToCsv: vi.fn(() => "csv-body"),
  buildExportFilename: vi.fn((label: string) => `bloom-${label}.csv`),
}));

import { buildExportFilename, transactionsToCsv } from "./export-csv";

/** Builds an Account fixture; override only what a test needs. */
function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "a-1",
    ownerName: "Alex Owner",
    nickname: null,
    accountType: "CHEQUING",
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

/** Builds a minimal Transaction fixture. */
function makeTxn(id: string): Transaction {
  return { id } as Transaction;
}

const clickSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom implements neither URL.createObjectURL nor anchor navigation; stub them.
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExportCsvButton", () => {
  it("disables the button and hints when there are no transactions", () => {
    render(<ExportCsvButton txns={[]} account={makeAccount()} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "No transactions to export");
  });

  it("pluralizes the export hint based on transaction count", () => {
    const { rerender } = render(
      <ExportCsvButton txns={[makeTxn("t-1")]} account={makeAccount()} />
    );
    expect(screen.getByRole("button")).toHaveAttribute("title", "Export 1 transaction as CSV");

    rerender(<ExportCsvButton txns={[makeTxn("t-1"), makeTxn("t-2")]} account={makeAccount()} />);
    expect(screen.getByRole("button")).toHaveAttribute("title", "Export 2 transactions as CSV");
  });

  it("builds and downloads a CSV, naming the file after the nickname", () => {
    const txns = [makeTxn("t-1")];
    render(<ExportCsvButton txns={txns} account={makeAccount({ nickname: "Rainy Day" })} />);

    fireEvent.click(screen.getByRole("button"));

    expect(transactionsToCsv).toHaveBeenCalledWith(txns);
    expect(buildExportFilename).toHaveBeenCalledWith("Rainy Day");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("falls back to the owner name when there is no nickname", () => {
    render(<ExportCsvButton txns={[makeTxn("t-1")]} account={makeAccount({ nickname: null })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(buildExportFilename).toHaveBeenCalledWith("Alex Owner");
  });
});
