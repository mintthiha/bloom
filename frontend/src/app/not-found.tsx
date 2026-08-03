import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

/** Rendered for unmatched routes and any `notFound()` call across the app. */
export default function NotFound() {
  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "64px 24px" }}>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
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
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              textDecoration: "none",
            }}
          >
            Back to home
          </Link>
        }
      />
    </div>
  );
}
