import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceErrorPage } from "./ServiceErrorPage";

const fetchMock = vi.fn();

const backendDownReport = {
  frontend: { status: "ok", detail: "Next.js server is running." },
  backend: {
    status: "down",
    detail: "Connection refused — the backend container or process isn't running.",
  },
  database: { status: "unchecked", detail: "Not checked — an earlier step failed." },
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify(backendDownReport), { status: 200 })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ServiceErrorPage", () => {
  it("shows the title, description, and a retry that calls back", () => {
    const handleRetry = vi.fn();
    render(
      <ServiceErrorPage
        title="Bloom couldn't load your dashboard"
        description="Your data is safe."
        onRetry={handleRetry}
      />
    );

    expect(screen.getByText("Bloom couldn't load your dashboard")).toBeInTheDocument();
    expect(screen.getByText("Your data is safe.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(handleRetry).toHaveBeenCalledOnce();
  });

  it("shows a home link by default and hides it when asked", () => {
    const { rerender } = render(
      <ServiceErrorPage title="Failed" description="Details" onRetry={vi.fn()} />
    );
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");

    rerender(
      <ServiceErrorPage
        title="Failed"
        description="Details"
        onRetry={vi.fn()}
        shouldShowHomeLink={false}
      />
    );
    expect(screen.queryByRole("link", { name: "Back to home" })).not.toBeInTheDocument();
  });

  it("keeps the technical details collapsed and runs no health check until asked", () => {
    render(<ServiceErrorPage title="Failed" description="Details" onRetry={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Show technical details" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByText("Service status")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reveals which service is down when the details are opened", async () => {
    render(<ServiceErrorPage title="Failed" description="Details" onRetry={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Show technical details" }));

    expect(screen.getByRole("button", { name: "Hide technical details" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(
      await screen.findByText(
        "Connection refused — the backend container or process isn't running."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("· Down")).toBeInTheDocument();
    expect(screen.getByText("· OK")).toBeInTheDocument();
    expect(screen.getByText("· Not checked")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/health", { cache: "no-store" });
  });

  it("shows the thrown error and its reference in the details", async () => {
    const error = Object.assign(new Error("Cannot read properties of undefined"), {
      digest: "digest-42",
    });
    render(
      <ServiceErrorPage title="Failed" description="Details" onRetry={vi.fn()} error={error} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show technical details" }));

    expect(await screen.findByText("Cannot read properties of undefined")).toBeInTheDocument();
    expect(screen.getByText("digest-42")).toBeInTheDocument();
  });

  it("runs the health check again on request", async () => {
    render(<ServiceErrorPage title="Failed" description="Details" onRetry={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show technical details" }));
    const checkAgainButton = await screen.findByRole("button", { name: "Check again" });

    fireEvent.click(checkAgainButton);

    await screen.findByRole("button", { name: "Check again" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
