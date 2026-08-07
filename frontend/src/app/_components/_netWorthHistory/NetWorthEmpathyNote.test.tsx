import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NetWorthEmpathyNote } from "./NetWorthEmpathyNote";
import type { NetWorthSnapshot } from "@/lib/api";

/** Builds a net worth snapshot; override only the fields a test cares about. */
function makeSnapshot(month: string, netWorth: number): NetWorthSnapshot {
  return {
    id: `snap-${month}`,
    month,
    netWorth,
    totalAssets: Math.max(netWorth, 0),
    totalDebt: Math.max(-netWorth, 0),
  };
}

const NOTE_TEXT = /Having a negative net worth early in life is completely normal/;

describe("NetWorthEmpathyNote", () => {
  it("renders nothing when there is no history", () => {
    const { container } = render(<NetWorthEmpathyNote history={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the latest net worth is non-negative", () => {
    const { container } = render(<NetWorthEmpathyNote history={[makeSnapshot("2026-07", 0)]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the empathy note when the latest net worth is negative", () => {
    render(<NetWorthEmpathyNote history={[makeSnapshot("2026-07", -500)]} />);
    expect(screen.getByText(NOTE_TEXT)).toBeInTheDocument();
  });

  it("adds the improvement line when net worth rose from the prior month", () => {
    render(
      <NetWorthEmpathyNote
        history={[makeSnapshot("2026-06", -800), makeSnapshot("2026-07", -500)]}
      />
    );
    expect(screen.getByText(/Up \$300\.00 from last month/)).toBeInTheDocument();
  });

  it("omits the improvement line when net worth fell", () => {
    render(
      <NetWorthEmpathyNote
        history={[makeSnapshot("2026-06", -400), makeSnapshot("2026-07", -900)]}
      />
    );
    expect(screen.getByText(NOTE_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(/from last month/)).not.toBeInTheDocument();
  });

  it("omits the improvement line when there is only one negative month", () => {
    render(<NetWorthEmpathyNote history={[makeSnapshot("2026-07", -500)]} />);
    expect(screen.queryByText(/from last month/)).not.toBeInTheDocument();
  });
});
