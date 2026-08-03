import { LoaderCircle } from "lucide-react";

/**
 * Route-transition fallback shown while a segment's server work resolves. Pages render their own
 * in-page skeletons after mounting, so this is kept minimal to avoid competing with them.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        color: "var(--text-muted)",
      }}
    >
      <LoaderCircle className="spin" size={24} strokeWidth={1.75} aria-hidden />
    </div>
  );
}
