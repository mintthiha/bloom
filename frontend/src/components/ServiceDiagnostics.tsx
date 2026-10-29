"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Minus, X, type LucideIcon } from "lucide-react";
import {
  SERVICE_LABELS,
  formatDiagnosticsForCopy,
  requestServiceHealthReport,
  type ServiceHealthReport,
  type ServiceName,
  type ServiceStatus,
} from "@/lib/service-health";

interface ServiceDiagnosticsProps {
  /** The error that brought the user to the error page, when one was thrown. */
  error?: Error & { digest?: string };
  /** DOM id so the toggle that reveals this panel can point at it with aria-controls. */
  id?: string;
}

const STATUS_APPEARANCE: Record<ServiceStatus, { icon: LucideIcon; color: string; label: string }> =
  {
    ok: { icon: Check, color: "var(--positive)", label: "OK" },
    down: { icon: X, color: "var(--negative-soft)", label: "Down" },
    unchecked: { icon: Minus, color: "var(--text-muted)", label: "Not checked" },
  };

const technicalTextStyle: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "12px",
  overflowWrap: "anywhere",
};

const smallButtonStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  padding: "7px 12px",
  borderRadius: "8px",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  cursor: "pointer",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
  marginBottom: "6px",
};

// Stack traces point into source files, so they are shown only in local development builds.
const isDevelopmentBuild = process.env.NODE_ENV === "development";

/**
 * Technical details for the error page: checks each link from the browser to Postgres and shows
 * which one is down, plus the thrown error, so a developer can tell "backend container is off"
 * from "database is down" from "the frontend crashed" at a glance.
 */
export function ServiceDiagnostics({ error, id }: ServiceDiagnosticsProps) {
  const [report, setReport] = useState<ServiceHealthReport | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [hasCopied, setHasCopied] = useState(false);

  /** Runs the health check and records when it finished. */
  const runHealthCheck = useCallback(async () => {
    setIsChecking(true);
    const nextReport = await requestServiceHealthReport();
    setReport(nextReport);
    setCheckedAt(new Date());
    setIsChecking(false);
  }, []);

  /** Checks the services as soon as the details are opened. */
  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  /** Copies a plain-text summary of the diagnostics so it can be pasted into a bug report. */
  async function handleCopyDetails() {
    try {
      await navigator.clipboard.writeText(
        formatDiagnosticsForCopy(report, error, checkedAt ?? new Date())
      );
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Clipboard access was blocked; the details stay on screen to select by hand.
    }
  }

  return (
    <div
      id={id}
      style={{
        marginTop: "12px",
        textAlign: "left",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <p style={sectionLabelStyle}>Service status</p>
      <ul
        aria-live="polite"
        aria-busy={isChecking}
        style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "12px" }}
      >
        {(Object.keys(SERVICE_LABELS) as ServiceName[]).map((name) => {
          const check = isChecking ? null : report?.[name];
          const appearance = check ? STATUS_APPEARANCE[check.status] : null;
          const StatusIcon = appearance?.icon ?? Minus;
          return (
            <li key={name} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span
                aria-hidden
                style={{
                  color: appearance?.color ?? "var(--text-muted)",
                  marginTop: "2px",
                  flexShrink: 0,
                }}
              >
                <StatusIcon size={16} strokeWidth={2.25} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {SERVICE_LABELS[name]}
                  <span style={{ color: appearance?.color ?? "var(--text-muted)" }}>
                    {" "}
                    · {appearance?.label ?? "Checking…"}
                  </span>
                </p>
                {check && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                      marginTop: "2px",
                    }}
                  >
                    {check.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <div
          style={{ borderTop: "1px solid var(--border)", marginTop: "16px", paddingTop: "16px" }}
        >
          <p style={sectionLabelStyle}>Error</p>
          <p style={{ ...technicalTextStyle, color: "var(--text-primary)" }}>
            {error.message || error.name}
          </p>
          {error.digest && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
              Reference <span style={technicalTextStyle}>{error.digest}</span> — matches the entry
              in the frontend server logs.
            </p>
          )}
          {isDevelopmentBuild && error.stack && (
            <pre
              style={{
                ...technicalTextStyle,
                fontSize: "11px",
                color: "var(--text-muted)",
                whiteSpace: "pre-wrap",
                maxHeight: "200px",
                overflowY: "auto",
                marginTop: "10px",
              }}
            >
              {error.stack}
            </pre>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={runHealthCheck}
          disabled={isChecking}
          className="press"
          style={{
            ...smallButtonStyle,
            opacity: isChecking ? 0.6 : 1,
            cursor: isChecking ? "not-allowed" : "pointer",
          }}
        >
          {isChecking ? "Checking…" : "Check again"}
        </button>
        <button
          type="button"
          onClick={handleCopyDetails}
          disabled={isChecking}
          className="press"
          style={{
            ...smallButtonStyle,
            opacity: isChecking ? 0.6 : 1,
            cursor: isChecking ? "not-allowed" : "pointer",
          }}
        >
          {hasCopied ? "Copied" : "Copy details"}
        </button>
      </div>
    </div>
  );
}
