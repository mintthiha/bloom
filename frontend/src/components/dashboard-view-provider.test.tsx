import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardViewProvider, useDashboardView } from "./dashboard-view-provider";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

import { useIsMobile } from "@/hooks/use-mobile";

function DashboardViewProbe() {
  const { view, effectiveView, setView } = useDashboardView();

  return (
    <div>
      <p data-testid="dashboard-view">{view}</p>
      <p data-testid="effective-view">{effectiveView}</p>
      <button type="button" onClick={() => setView("single")}>
        Single
      </button>
      <button type="button" onClick={() => setView("double")}>
        Double
      </button>
    </div>
  );
}

describe("DashboardViewProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it("defaults to the double-column dashboard view", () => {
    render(
      <DashboardViewProvider>
        <DashboardViewProbe />
      </DashboardViewProvider>
    );

    expect(screen.getByTestId("dashboard-view")).toHaveTextContent("double");
  });

  it("loads a previously saved dashboard view from localStorage", async () => {
    window.localStorage.setItem("bloom_dashboard_view", "single");

    render(
      <DashboardViewProvider>
        <DashboardViewProbe />
      </DashboardViewProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-view")).toHaveTextContent("single");
    });
  });

  it("updates and persists the dashboard view", async () => {
    render(
      <DashboardViewProvider>
        <DashboardViewProbe />
      </DashboardViewProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Single" }));

    expect(screen.getByTestId("dashboard-view")).toHaveTextContent("single");
    expect(window.localStorage.getItem("bloom_dashboard_view")).toBe("single");
  });
});

describe("useDashboardView — mobile-aware effectiveView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it("returns double as effectiveView on desktop when stored view is double", () => {
    render(
      <DashboardViewProvider>
        <DashboardViewProbe />
      </DashboardViewProvider>
    );

    expect(screen.getByTestId("effective-view")).toHaveTextContent("double");
  });

  it("collapses effectiveView to single on mobile regardless of stored double preference", () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(
      <DashboardViewProvider>
        <DashboardViewProbe />
      </DashboardViewProvider>
    );

    expect(screen.getByTestId("effective-view")).toHaveTextContent("single");
    expect(screen.getByTestId("dashboard-view")).toHaveTextContent("double");
  });

  it("preserves the stored double preference while mobile collapses layout", async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);

    render(
      <DashboardViewProvider>
        <DashboardViewProbe />
      </DashboardViewProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Double" }));

    expect(screen.getByTestId("dashboard-view")).toHaveTextContent("double");
    expect(screen.getByTestId("effective-view")).toHaveTextContent("single");
  });
});
