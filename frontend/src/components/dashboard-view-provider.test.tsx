import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DashboardViewProvider, useDashboardView } from "./dashboard-view-provider";

function DashboardViewProbe() {
  const { view, setView } = useDashboardView();

  return (
    <div>
      <p data-testid="dashboard-view">{view}</p>
      <button type="button" onClick={() => setView("single")}>Single</button>
      <button type="button" onClick={() => setView("double")}>Double</button>
    </div>
  );
}

describe("DashboardViewProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
