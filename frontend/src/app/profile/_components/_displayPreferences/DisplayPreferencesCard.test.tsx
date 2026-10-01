import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisplayPreferencesCard } from "./DisplayPreferencesCard";
import { DisplayPreferencesProvider } from "@/components/display-preferences-provider";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";

describe("DisplayPreferencesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("toggles hide cents on and confirms with a toast", () => {
    render(
      <DisplayPreferencesProvider>
        <DisplayPreferencesCard />
      </DisplayPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Hide cents" }));

    expect(screen.getByRole("switch", { name: "Hide cents" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(toast.success).toHaveBeenCalledWith("Now hiding cents");
  });

  it("toggles privacy mode on and confirms with a toast", () => {
    render(
      <DisplayPreferencesProvider>
        <DisplayPreferencesCard />
      </DisplayPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Privacy mode" }));

    expect(screen.getByRole("switch", { name: "Privacy mode" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(toast.success).toHaveBeenCalledWith("Privacy mode on");
  });

  it("persists the preference to localStorage", () => {
    render(
      <DisplayPreferencesProvider>
        <DisplayPreferencesCard />
      </DisplayPreferencesProvider>
    );

    fireEvent.click(screen.getByRole("switch", { name: "Hide cents" }));

    expect(localStorage.getItem("bloom-hide-cents")).toBe("true");
  });
});
