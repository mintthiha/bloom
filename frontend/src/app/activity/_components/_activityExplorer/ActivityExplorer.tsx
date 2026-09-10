"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  ActivityActionKey,
  ActivityGroupKey,
  ActivityLogResult,
  ActivitySortKey,
} from "@/lib/api";
import { ActivityFilterBar } from "./ActivityFilterBar";
import { ActivityTable } from "./ActivityTable";

const PAGE_SIZE = 25;

/** Converts a native date-input value ("YYYY-MM-DD") to an ISO string at UTC midnight. */
function dateInputToIso(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

/** Converts a "to" date-input value to the exclusive end of that day (next midnight, UTC). */
function endDateInputToIso(value: string): string {
  const start = new Date(`${value}T00:00:00.000Z`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Stateful container for the activity page: owns the filters, search debounce, and paging,
 * fetches a page from the activity log endpoint, and renders the filter bar plus table.
 */
export function ActivityExplorer() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [action, setAction] = useState("");
  const [sort, setSort] = useState<ActivitySortKey>("date_desc");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<ActivityLogResult | null>(null);
  const [loading, setLoading] = useState(true);

  const hasActiveFilters = Boolean(search || group || action || from || to);

  /** Debounces the search box, committing it to the query and resetting to the first page. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  /** Fetches the current page whenever any filter, sort, or page number changes. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const withinDateRange = Boolean(from && to);
    api
      .listActivityLogs({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: search || undefined,
        group: (group || undefined) as ActivityGroupKey | undefined,
        action: (action || undefined) as ActivityActionKey | undefined,
        sort,
        start: withinDateRange ? dateInputToIso(from) : undefined,
        end: withinDateRange ? endDateInputToIso(to) : undefined,
      })
      .then((nextResult) => {
        if (!cancelled) setResult(nextResult);
      })
      .catch(() => {
        if (!cancelled) setResult({ logs: [], total: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, group, action, sort, from, to, page]);

  /** Applies a filter change and returns to the first page so results stay consistent. */
  const changeFilter = useCallback(<T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }, []);

  /** Clears every filter and search term, returning to the default view. */
  function handleClear() {
    setSearchInput("");
    setSearch("");
    setGroup("");
    setAction("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <ActivityFilterBar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        group={group}
        onGroupChange={changeFilter(setGroup)}
        action={action}
        onActionChange={changeFilter(setAction)}
        sort={sort}
        onSortChange={changeFilter<ActivitySortKey>(setSort)}
        from={from}
        onFromChange={changeFilter(setFrom)}
        to={to}
        onToChange={changeFilter(setTo)}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClear}
      />

      <div style={{ marginBottom: "12px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {loading
            ? "Loading activity…"
            : total === 0
              ? "No events"
              : `Showing ${rangeStart}–${rangeEnd} of ${total} event${total === 1 ? "" : "s"}`}
        </p>
      </div>

      <ActivityTable
        rows={result?.logs ?? []}
        loading={loading}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          <span className="num" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="press"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              style={paginationButtonStyle(page <= 1 || loading)}
            >
              Previous
            </button>
            <button
              type="button"
              className="press"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              style={paginationButtonStyle(page >= totalPages || loading)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Builds the style for a pagination button, dimming and disabling it when unavailable. */
function paginationButtonStyle(disabled: boolean) {
  return {
    background: "var(--surface-1)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "7px 14px",
    fontSize: "12px",
    fontWeight: 600,
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  } as const;
}
