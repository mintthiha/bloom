import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomProgramForm } from "./CustomProgramForm";

/** Renders the form with spy callbacks. */
function renderForm() {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<CustomProgramForm onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel };
}

describe("CustomProgramForm", () => {
  it("marks Points as the selected reward type by default", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Points" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Cash Back" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("moves the selection when another reward type is chosen", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Cash Back" }));

    expect(screen.getByRole("button", { name: "Cash Back" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Points" })).toHaveAttribute("aria-pressed", "false");
  });

  it("adds and removes bonus category rows", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "+ Add category" }));
    expect(screen.getByRole("combobox", { name: "Reward category" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove category" }));
    expect(screen.queryByRole("combobox", { name: "Reward category" })).not.toBeInTheDocument();
  });

  it("saves a cash-back template with its bonus categories", () => {
    const { onSave } = renderForm();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Grocery Card" } });
    fireEvent.click(screen.getByRole("button", { name: "Cash Back" }));
    fireEvent.change(screen.getByLabelText("Base Rate"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add category" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Reward category" }), {
      target: { value: "Groceries" },
    });
    fireEvent.change(screen.getByLabelText("Cashback rate (%)"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Template" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Grocery Card",
        rewardType: "cashback",
        baseRate: 1,
        categoryMultipliers: { Groceries: 4 },
      })
    );
  });

  it("explains what is missing instead of saving an incomplete template", () => {
    const { onSave } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Save Template" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("cancels without saving", () => {
    const { onSave, onCancel } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
