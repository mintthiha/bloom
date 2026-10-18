"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { queueAskBloomPrompt } from "@/lib/ask-bloom-handoff";

type AskBloomButtonProps = {
  /** Builds the question from the card's current figures; only called when the button is clicked. */
  buildPrompt: () => string;
  /** What the card is about, completing the accessible name "Ask Bloom about your …". */
  topic: string;
};

/** Header pill on a dashboard card that opens the Bloom AI chat already asking about that card. */
export function AskBloomButton({ buildPrompt, topic }: AskBloomButtonProps) {
  const router = useRouter();

  /** Queues the card's question for the chat to send, then takes the user to the chat. */
  function handleClick() {
    queueAskBloomPrompt(buildPrompt());
    router.push("/learn");
  }

  return (
    <button
      type="button"
      className="ask-bloom-button"
      onClick={handleClick}
      aria-label={`Ask Bloom about your ${topic}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 11px",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <Sparkles size={13} aria-hidden="true" />
      Ask Bloom
    </button>
  );
}
