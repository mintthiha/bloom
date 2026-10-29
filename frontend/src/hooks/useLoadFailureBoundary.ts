import { useCallback, useState } from "react";

/**
 * Hands a failed data load to the route's error boundary (`app/error.tsx`), which replaces the
 * page with the full error page and its diagnostics — instead of the page falling through to an
 * empty state that wrongly tells the user they have no data. Error boundaries only catch errors
 * thrown while rendering, so the failure is stored and re-thrown on the next render.
 *
 * Use it for the load a page can't work without; keep toasts for reloads after an edit.
 */
export function useLoadFailureBoundary(): (failure: unknown) => void {
  const [loadFailure, setLoadFailure] = useState<Error | null>(null);

  /** Records the failure so the next render throws it to the boundary. */
  const reportLoadFailure = useCallback((failure: unknown) => {
    setLoadFailure(failure instanceof Error ? failure : new Error(String(failure)));
  }, []);

  if (loadFailure) throw loadFailure;
  return reportLoadFailure;
}
