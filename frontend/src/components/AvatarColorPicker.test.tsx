import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvatarColorPicker } from "./AvatarColorPicker";

/** Renders the picker with a saved choice and returns the change spy. */
function renderPicker(value: "VIOLET" | null) {
  const onChange = vi.fn();
  render(
    <AvatarColorPicker
      value={value}
      onChange={onChange}
      firstName="Ada"
      lastName="Lovelace"
      fallbackLabel="ada@bloom.test"
    />
  );
  return onChange;
}

describe("AvatarColorPicker", () => {
  it("offers an Auto option plus one swatch per colour", () => {
    renderPicker(null);

    const swatches = screen.getAllByRole("radio");
    expect(swatches).toHaveLength(7);
    expect(screen.getByRole("radio", { name: "Auto colour from your name" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Violet" })).toBeInTheDocument();
  });

  it("marks Auto as checked when no colour is saved", () => {
    renderPicker(null);

    expect(screen.getByRole("radio", { name: "Auto colour from your name" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Violet" })).not.toBeChecked();
  });

  it("marks the saved colour as checked", () => {
    renderPicker("VIOLET");

    expect(screen.getByRole("radio", { name: "Violet" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Auto colour from your name" })).not.toBeChecked();
  });

  it("reports the picked colour to the parent", () => {
    const onChange = renderPicker(null);

    fireEvent.click(screen.getByRole("radio", { name: "Pink" }));

    expect(onChange).toHaveBeenCalledWith("PINK");
  });

  it("reports null when Auto is picked", () => {
    const onChange = renderPicker("VIOLET");

    fireEvent.click(screen.getByRole("radio", { name: "Auto colour from your name" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("previews the initials that will be saved", () => {
    renderPicker("VIOLET");

    expect(screen.getByRole("img", { name: "Avatar preview" })).toHaveTextContent("AL");
  });
});
