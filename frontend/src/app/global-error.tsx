"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  /** The error thrown while rendering the root layout. */
  error: Error & { digest?: string };
  /** Re-mounts the root to retry after a transient failure. */
  reset: () => void;
}

/**
 * Last-resort boundary for errors thrown in the root layout itself. It replaces the entire document,
 * so it renders its own <html>/<body> and uses hard-coded colors rather than theme CSS variables
 * (which are not guaranteed to be loaded when the layout has failed).
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  /** Surfaces the layout-level error so it is inspectable in the console. */
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
            background: "#060a14",
            color: "#eef1f7",
            fontFamily: "var(--font-sans), ui-sans-serif, system-ui, -apple-system, sans-serif",
          }}
        >
          <p style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Something went wrong</p>
          <p style={{ fontSize: "13px", color: "#8b93a7", maxWidth: "320px", lineHeight: 1.5 }}>
            Bloom hit an unexpected error. Try reloading — your data is safe.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              fontSize: "13px",
              fontWeight: 600,
              padding: "9px 16px",
              borderRadius: "8px",
              background: "#141b2b",
              border: "1px solid #1b2334",
              color: "#eef1f7",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
