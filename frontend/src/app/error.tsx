"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

interface ErrorBoundaryProps {
  /** The error thrown while rendering the route segment. */
  error: Error & { digest?: string };
  /** Re-renders the segment to retry after a transient failure. */
  reset: () => void;
}

/** Route-level error boundary: shown when a page in this segment throws while rendering. */
export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  /** Surfaces the error to the console so it is inspectable during development and in browser logs. */
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "64px 24px" }}>
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="This section failed to load. You can try again — your data is safe."
        action={
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              type="button"
              onClick={reset}
              className="press"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600,
                padding: "9px 16px",
                borderRadius: "8px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              className="press"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600,
                padding: "9px 16px",
                borderRadius: "8px",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                textDecoration: "none",
              }}
            >
              Back to home
            </Link>
          </div>
        }
      />
    </div>
  );
}
