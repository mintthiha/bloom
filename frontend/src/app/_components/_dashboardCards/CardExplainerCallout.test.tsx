import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardExplainerCallout } from "./CardExplainerCallout";

describe("CardExplainerCallout", () => {
  it("renders the label, explanation, and the new-card marker", () => {
    render(
      <CardExplainerCallout
        label="Safe to Spend"
        howItWorks="Your liquid cash minus upcoming bills."
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText("Safe to Spend")).toBeInTheDocument();
    expect(screen.getByText("Your liquid cash minus upcoming bills.")).toBeInTheDocument();
    expect(screen.getByText("New card")).toBeInTheDocument();
  });

  it("calls onDismiss when 'Got it' is clicked", () => {
    const onDismiss = vi.fn();
    render(
      <CardExplainerCallout label="Goals" howItWorks="Track targets." onDismiss={onDismiss} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
