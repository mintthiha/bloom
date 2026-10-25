"use client";

import { useEffect } from "react";
import { ServiceErrorPage } from "@/components/ServiceErrorPage";

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
    <ServiceErrorPage
      title="Something went wrong"
      description="This page failed to load. You can try again — your data is safe."
      onRetry={reset}
      error={error}
    />
  );
}
