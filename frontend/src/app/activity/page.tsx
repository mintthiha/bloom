"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ActivityLogEntry } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { BackToHome } from "@/components/BackToHome";
import { ActivityFeed } from "./_components/ActivityFeed";

const PAGE_SIZE = 25;

/** Infers the user's local time zone for timestamp display. */
function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const timeZone = getTimeZone();

  /** Loads a page of activity logs for the current page number. */
  const loadLogs = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const offset = (targetPage - 1) * PAGE_SIZE;
      const result = await api.listActivityLogs(PAGE_SIZE, offset);
      setLogs(result.logs);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs(page);
  }, [loadLogs, page]);

  /** Changes the active page and reloads the log entries for that page. */
  function handlePageChange(nextPage: number) {
    setPage(nextPage);
  }

  return (
    <div
      style={{
        maxWidth: "860px",
        margin: "0 auto",
        padding: "32px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <BackToHome />
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            marginTop: "16px",
            marginBottom: "4px",
          }}
        >
          Activity
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          A log of all actions you've taken in Bloom.
        </p>
      </div>

      <CollapsibleCard
        eyebrow="History"
        title="All Activity"
        description={loading ? "Loading…" : `${total} event${total === 1 ? "" : "s"} recorded`}
      >
        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--text-muted)", padding: "16px 0" }}>
            Loading activity…
          </p>
        ) : (
          <ActivityFeed
            logs={logs}
            total={total}
            page={page}
            onPageChange={handlePageChange}
            timeZone={timeZone}
          />
        )}
      </CollapsibleCard>
    </div>
  );
}
