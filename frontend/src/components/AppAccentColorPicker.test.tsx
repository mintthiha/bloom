import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppAccentColorPicker } from "./AppAccentColorPicker";
import type { AccentColor } from "@/lib/app-accent";

/** Renders the picker with a saved choice and returns the change spy. */
function renderPicker(value: AccentColor) {
  const onChange = vi.fn();
  render(<AppAccentColorPicker value={value} onChange={onChange} />);
  return onChange;
}

describe("AppAccentColorPicker", () => {
  it("offers one swatch per accent colour", () => {
    renderPicker("AMBER");

    const swatches = screen.getAllByRole("radio");
    expect(swatches).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "Violet" })).toBeInTheDocument();
  });

  it("marks the saved colour as checked", () => {
    renderPicker("VIOLET");

    expect(screen.getByRole("radio", { name: "Violet" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Amber" })).not.toBeChecked();
  });

  it("reports the picked colour to the parent", () => {
    const onChange = renderPicker("AMBER");

    fireEvent.click(screen.getByRole("radio", { name: "Pink" }));

    expect(onChange).toHaveBeenCalledWith("PINK");
  });
});
