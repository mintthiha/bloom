import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateRangeControls } from "./date-range-controls";
import { getPresetDateRange } from "@/lib/date-range";

describe("DateRangeControls", () => {
  it("hides the custom date inputs for a preset range", () => {
    render(<DateRangeControls value={getPresetDateRange("this-month")} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Date range preset")).toHaveValue("this-month");
    expect(screen.queryByLabelText("Start date")).not.toBeInTheDocument();
  });

  it("emits the matching preset range when a preset is chosen", () => {
    const onChange = vi.fn();
    render(<DateRangeControls value={getPresetDateRange("this-month")} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Date range preset"), { target: { value: "all-time" } });

    expect(onChange).toHaveBeenCalledWith(getPresetDateRange("all-time"));
  });

  it("shows start and end inputs and relays edits for a custom range", () => {
    const value = { ...getPresetDateRange("this-month"), preset: "custom" as const };
    const onChange = vi.fn();
    render(<DateRangeControls value={value} onChange={onChange} />);

    const start = screen.getByLabelText("Start date");
    expect(start).toBeInTheDocument();
    fireEvent.change(start, { target: { value: "2026-03-01" } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ start: "2026-03-01" }));
  });

  it("switches into custom mode when Custom is selected", () => {
    const onChange = vi.fn();
    render(<DateRangeControls value={getPresetDateRange("this-month")} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Date range preset"), { target: { value: "custom" } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: "custom" }));
  });
});
