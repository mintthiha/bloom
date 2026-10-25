"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ServiceDiagnostics } from "@/components/ServiceDiagnostics";

interface ServiceErrorPageProps {
  /** Headline naming what failed, e.g. "Bloom couldn't load your dashboard". */
  title: string;
  /** Plain-language line reassuring the user and saying what to do. */
  description: string;
  /** Called by "Try again" — reload the data or reset the error boundary. */
  onRetry: () => void;
  /** The thrown error, shown in the technical details when present. */
  error?: Error & { digest?: string };
  /** Hide the home link on the dashboard itself, where it would just reload the same page. */
  shouldShowHomeLink?: boolean;
}

const DIAGNOSTICS_PANEL_ID = "service-diagnostics";

const buttonBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  fontWeight: 600,
  padding: "9px 16px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  cursor: "pointer",
  textDecoration: "none",
};

/**
 * Full-page replacement for content that couldn't load or crashed. The user gets a calm message
 * and a retry; a "technical details" toggle reveals which service is down for whoever is debugging.
 */
export function ServiceErrorPage({
  title,
  description,
  onRetry,
  error,
  shouldShowHomeLink = true,
}: ServiceErrorPageProps) {
  const [isShowingDetails, setIsShowingDetails] = useState(false);

  return (
    // Fills the viewport below the app shell's 56px header so the message sits in the vertical middle.
    <div
      style={{
        minHeight: "calc(100vh - 56px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "560px", margin: "0 auto" }}>
        <EmptyState
          icon={TriangleAlert}
          title={title}
          description={description}
          action={
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={onRetry}
                className="press"
                style={{
                  ...buttonBaseStyle,
                  background: "var(--surface-2)",
                  color: "var(--text-primary)",
                }}
              >
                Try again
              </button>
              {shouldShowHomeLink && (
                <Link
                  href="/"
                  className="press"
                  style={{
                    ...buttonBaseStyle,
                    background: "transparent",
                    color: "var(--text-secondary)",
                  }}
                >
                  Back to home
                </Link>
              )}
            </div>
          }
        />

        <div style={{ textAlign: "center", marginTop: "12px" }}>
          <button
            type="button"
            onClick={() => setIsShowingDetails((isShowing) => !isShowing)}
            aria-expanded={isShowingDetails}
            aria-controls={DIAGNOSTICS_PANEL_ID}
            className="press"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "none",
              border: "none",
              borderRadius: "6px",
              padding: "6px 8px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {isShowingDetails ? "Hide technical details" : "Show technical details"}
            <ChevronDown
              size={14}
              aria-hidden
              style={{ transform: isShowingDetails ? "rotate(180deg)" : "none" }}
            />
          </button>
        </div>

        {isShowingDetails && <ServiceDiagnostics id={DIAGNOSTICS_PANEL_ID} error={error} />}
      </div>
    </div>
  );
}
