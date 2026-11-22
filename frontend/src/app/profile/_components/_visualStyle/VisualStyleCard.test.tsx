import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VisualStyleCard } from "./VisualStyleCard";
import { VisualStyleProvider } from "@/components/visual-style-provider";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

/** Renders the card inside the real provider so selection flows through actual state. */
function renderCard() {
  return render(
    <VisualStyleProvider>
      <VisualStyleCard />
    </VisualStyleProvider>
  );
}

describe("VisualStyleCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute("data-visual-style");
  });

  it("offers both looks with classic selected by default", () => {
    renderCard();
    expect(screen.getByRole("radio", { name: /Classic/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /Extravagant/ })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("switches to extravagant, persists it, and confirms with a toast", () => {
    renderCard();
    fireEvent.click(screen.getByRole("radio", { name: /Extravagant/ }));

    expect(screen.getByRole("radio", { name: /Extravagant/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: /Classic/ })).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("bloom-visual-style")).toBe("extravagant");
    expect(document.documentElement).toHaveAttribute("data-visual-style", "extravagant");
    expect(toast.success).toHaveBeenCalledWith("Extravagant look on. Enjoy the show");
  });

  it("switches back to classic from a saved extravagant look", () => {
    localStorage.setItem("bloom-visual-style", "extravagant");
    renderCard();
    fireEvent.click(screen.getByRole("radio", { name: /Classic/ }));

    expect(screen.getByRole("radio", { name: /Classic/ })).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("bloom-visual-style")).toBe("classic");
    expect(document.documentElement).toHaveAttribute("data-visual-style", "classic");
    expect(toast.success).toHaveBeenCalledWith("Back to the classic look");
  });

  it("does nothing when the already-selected look is clicked", () => {
    renderCard();
    fireEvent.click(screen.getByRole("radio", { name: /Classic/ }));

    expect(toast.success).not.toHaveBeenCalled();
    expect(localStorage.getItem("bloom-visual-style")).toBeNull();
  });
});
