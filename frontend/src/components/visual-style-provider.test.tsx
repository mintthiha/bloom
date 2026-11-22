import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useVisualStyle, VisualStyleProvider } from "./visual-style-provider";

/** Minimal consumer exposing the current look and both switches. */
function VisualStyleProbe() {
  const { visualStyle, setVisualStyle } = useVisualStyle();
  return (
    <div>
      <p>look: {visualStyle}</p>
      <button onClick={() => setVisualStyle("extravagant")}>go extravagant</button>
      <button onClick={() => setVisualStyle("classic")}>go classic</button>
    </div>
  );
}

/** Renders the probe inside the provider. */
function renderProbe() {
  return render(
    <VisualStyleProvider>
      <VisualStyleProbe />
    </VisualStyleProvider>
  );
}

describe("VisualStyleProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-visual-style");
  });

  it("defaults to the classic look", () => {
    renderProbe();
    expect(screen.getByText("look: classic")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-visual-style", "classic");
  });

  it("restores a saved extravagant look", () => {
    localStorage.setItem("bloom-visual-style", "extravagant");
    renderProbe();
    expect(screen.getByText("look: extravagant")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-visual-style", "extravagant");
  });

  it("switches to extravagant, persists it, and updates the document", () => {
    renderProbe();
    fireEvent.click(screen.getByText("go extravagant"));
    expect(screen.getByText("look: extravagant")).toBeInTheDocument();
    expect(localStorage.getItem("bloom-visual-style")).toBe("extravagant");
    expect(document.documentElement).toHaveAttribute("data-visual-style", "extravagant");
  });

  it("switches back to classic", () => {
    localStorage.setItem("bloom-visual-style", "extravagant");
    renderProbe();
    fireEvent.click(screen.getByText("go classic"));
    expect(screen.getByText("look: classic")).toBeInTheDocument();
    expect(localStorage.getItem("bloom-visual-style")).toBe("classic");
    expect(document.documentElement).toHaveAttribute("data-visual-style", "classic");
  });
});
