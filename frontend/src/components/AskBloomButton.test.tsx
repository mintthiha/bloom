import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskBloomButton } from "./AskBloomButton";
import { takeQueuedAskBloomPrompt } from "@/lib/ask-bloom-handoff";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

afterEach(() => {
  sessionStorage.clear();
  routerPush.mockReset();
});

describe("AskBloomButton", () => {
  it("names the card's topic in its accessible name", () => {
    render(<AskBloomButton topic="budgets" buildPrompt={() => "Question"} />);
    expect(
      screen.getByRole("button", { name: "Ask Bloom about your budgets" })
    ).toBeInTheDocument();
  });

  it("only builds the question when clicked", () => {
    const buildPrompt = vi.fn(() => "Question");
    render(<AskBloomButton topic="budgets" buildPrompt={buildPrompt} />);
    expect(buildPrompt).not.toHaveBeenCalled();
  });

  it("queues the card's question for the chat and opens the Learn page", () => {
    render(<AskBloomButton topic="budgets" buildPrompt={() => "How are my budgets?"} />);

    fireEvent.click(screen.getByRole("button", { name: /Ask Bloom/ }));

    expect(takeQueuedAskBloomPrompt()).toBe("How are my budgets?");
    expect(routerPush).toHaveBeenCalledWith("/learn");
  });
});
