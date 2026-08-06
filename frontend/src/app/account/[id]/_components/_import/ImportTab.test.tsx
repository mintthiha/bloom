import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportTab } from "./ImportTab";
import type { AutoCategorizationRule } from "@/lib/api";

const { apiMock } = vi.hoisted(() => ({ apiMock: { importCsv: vi.fn() } }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { ...actual.api, importCsv: apiMock.importCsv } };
});

/** Selects a CSV file on the hidden file input, driving the FileReader parse path. */
function selectCsv(text: string) {
  const input = screen.getByLabelText("Choose file") as HTMLInputElement;
  const file = new File([text], "import.csv", { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
}

const HEADER = "date,type,amount,description,merchant,category";

function renderTab(rules: AutoCategorizationRule[] = []) {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  render(
    <ImportTab
      accountId="a-1"
      onSuccess={onSuccess}
      onError={onError}
      categorizationRules={rules}
    />
  );
  return { onSuccess, onError };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ImportTab", () => {
  it("renders instructions and the file picker before any file is chosen", () => {
    renderTab();
    expect(screen.getByLabelText("Choose file")).toBeInTheDocument();
    expect(screen.getByText("Download template")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("parses a valid file into a preview with an import button", async () => {
    renderTab();
    selectCsv(`${HEADER}\n2026-01-15,deposit,1500,Salary,,Salary`);

    expect(await screen.findByText("1 row parsed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 1 transaction" })).toBeInTheDocument();
  });

  it("flags rows with errors and excludes them from the import count", async () => {
    renderTab();
    selectCsv(`${HEADER}\n2026-01-15,deposit,1500,Salary,,Salary\nbad,teleport,-5,,,`);

    expect(await screen.findByText("2 rows parsed")).toBeInTheDocument();
    expect(screen.getByText("1 with errors")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 1 transaction" })).toBeInTheDocument();
  });

  it("shows a parse error when the file has no data rows", async () => {
    renderTab();
    selectCsv(HEADER);

    expect(await screen.findByText("No data rows found in file.")).toBeInTheDocument();
  });

  it("applies a user categorization rule to matching merchants", async () => {
    renderTab([
      { id: "r-1", userId: "u-1", merchant: "Loblaws", category: "Food" } as AutoCategorizationRule,
    ]);
    selectCsv(`${HEADER}\n2026-01-18,withdrawal,50,Groceries,Loblaws,`);

    await screen.findByText("1 row parsed");
    const table = screen.getByRole("table");
    expect(within(table).getByText("Food")).toBeInTheDocument();
  });

  it("imports the valid rows and reports the count", async () => {
    apiMock.importCsv.mockResolvedValue({ imported: 1, account: {} });
    const { onSuccess } = renderTab();
    selectCsv(`${HEADER}\n2026-01-15,deposit,1500,Salary,,Salary`);

    fireEvent.click(await screen.findByRole("button", { name: "Import 1 transaction" }));

    await waitFor(() => expect(apiMock.importCsv).toHaveBeenCalledWith("a-1", expect.any(Array)));
    expect(onSuccess).toHaveBeenCalledWith(1);
  });

  it("surfaces an error via onError when the import fails", async () => {
    apiMock.importCsv.mockRejectedValue(new Error("server down"));
    const { onError } = renderTab();
    selectCsv(`${HEADER}\n2026-01-15,deposit,1500,Salary,,Salary`);

    fireEvent.click(await screen.findByRole("button", { name: "Import 1 transaction" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("server down"));
  });

  it("lets the user edit a category cell inline", async () => {
    renderTab();
    selectCsv(`${HEADER}\n2026-01-15,deposit,1500,Paycheque,,`);
    await screen.findByText("1 row parsed");

    // Both empty category and merchant cells show an em-dash; the category column comes first.
    fireEvent.click(screen.getAllByText("—")[0]);
    const editor = screen.getByLabelText("Edit category");
    fireEvent.change(editor, { target: { value: "Salary" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Salary")).toBeInTheDocument();
  });

  it("paginates when there are more than ten rows", async () => {
    renderTab();
    const many = Array.from(
      { length: 12 },
      (_, i) => `2026-01-${String(i + 1).padStart(2, "0")},deposit,${i + 1},row,,`
    ).join("\n");
    selectCsv(`${HEADER}\n${many}`);

    expect(await screen.findByText("12 rows parsed")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
});
