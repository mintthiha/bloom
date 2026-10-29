import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestErrorBoundary } from "@/test-utils/TestErrorBoundary";
import { useLoadFailureBoundary } from "./useLoadFailureBoundary";

/** Loads with the given promise and reports a failure to the boundary. */
function LoadingComponent({ load }: { load: () => Promise<unknown> }) {
  const reportLoadFailure = useLoadFailureBoundary();

  useEffect(() => {
    load().catch(reportLoadFailure);
  }, [load, reportLoadFailure]);

  return <p>Page content</p>;
}

beforeEach(() => {
  // React logs every error a boundary catches; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLoadFailureBoundary", () => {
  it("leaves the page alone while the load succeeds", async () => {
    render(
      <TestErrorBoundary>
        <LoadingComponent load={() => Promise.resolve([])} />
      </TestErrorBoundary>
    );

    expect(await screen.findByText("Page content")).toBeInTheDocument();
    expect(screen.queryByText(/caught/i)).not.toBeInTheDocument();
  });

  it("hands a failed load to the nearest error boundary", async () => {
    render(
      <TestErrorBoundary>
        <LoadingComponent load={() => Promise.reject(new Error("Bloom can't reach its server"))} />
      </TestErrorBoundary>
    );

    expect(await screen.findByText("Caught: Bloom can't reach its server")).toBeInTheDocument();
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
  });

  it("wraps a non-Error rejection so the boundary still gets a message", async () => {
    render(
      <TestErrorBoundary>
        <LoadingComponent load={() => Promise.reject("timeout")} />
      </TestErrorBoundary>
    );

    expect(await screen.findByText("Caught: timeout")).toBeInTheDocument();
  });
});
