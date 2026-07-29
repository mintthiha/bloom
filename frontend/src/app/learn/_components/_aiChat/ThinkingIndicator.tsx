"use client";

import { useEffect, useState } from "react";

/** Rotating status lines so a longer wait feels like the assistant is actively working. */
const THINKING_PHRASES = [
  "Thinking",
  "Reviewing your finances",
  "Checking the numbers",
  "Putting it together",
];

const PHRASE_INTERVAL_MS = 2200;

/** Animated placeholder shown in the assistant bubble before the first token streams in. */
export function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  /** Cycles through the status phrases while the assistant is still working. */
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((previous) => (previous + 1) % THINKING_PHRASES.length);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      style={{
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
      }}
    >
      {/* Keyed so each new phrase re-triggers the fade-in animation. */}
      <span key={phraseIndex} className="thinking-phrase">
        {THINKING_PHRASES[phraseIndex]}
      </span>
      <span className="thinking-dots" aria-hidden="true">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </span>
    </span>
  );
}
