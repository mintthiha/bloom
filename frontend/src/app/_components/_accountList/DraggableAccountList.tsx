"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Account, AccountType } from "@/lib/api";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { formatCurrency } from "@/lib/format";

const ORDER_KEY = "bloom-account-order";

const ACCOUNT_GROUPS: {
  id: string;
  title: string;
  description: string;
  types: AccountType[];
}[] = [
  {
    id: "cash",
    title: "Cash Accounts",
    description: "Daily banking and savings balances.",
    types: ["CHEQUING", "SAVINGS"],
  },
  {
    id: "registered",
    title: "Registered Accounts",
    description: "Tax-advantaged savings and investment accounts.",
    types: ["TFSA", "RRSP", "FHSA"],
  },
  {
    id: "credit",
    title: "Credit Accounts",
    description: "Debt balances tracked separately from cash.",
    types: ["CREDIT"],
  },
];


interface DraggableAccountListProps {
  accounts: Account[];
  loading: boolean;
}

/**
 * Account list grouped by type with drag-to-reorder within each group.
 * Display order is persisted to localStorage under `bloom-account-order`.
 */
export function DraggableAccountList({
  accounts,
  loading,
}: DraggableAccountListProps) {
  const [order, setOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggingGroupId = useRef<string | null>(null);

  /** Load persisted order from localStorage after mount. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY);
      if (saved) setOrder(JSON.parse(saved));
    } catch {
      // ignore parse errors
    }
  }, []);

  /** Accounts sorted by persisted order, with new/unknown accounts appended at end. */
  const sortedAccounts = useMemo(() => {
    if (!order.length) return accounts;
    const indexMap = new Map(order.map((id, i) => [id, i]));
    return [...accounts].sort((a, b) => {
      const ia = indexMap.get(a.id) ?? Infinity;
      const ib = indexMap.get(b.id) ?? Infinity;
      return ia - ib;
    });
  }, [accounts, order]);

  const groupedAccounts = useMemo(
    () =>
      ACCOUNT_GROUPS.map((group) => ({
        ...group,
        accounts: sortedAccounts.filter((acc) =>
          group.types.includes(acc.accountType),
        ),
      })).filter((group) => group.accounts.length > 0),
    [sortedAccounts],
  );

  /** Moves draggedId to just before targetId, then persists to localStorage. */
  function handleReorder(draggedId: string, targetId: string) {
    setOrder((prev) => {
      const allIds = accounts.map((a) => a.id);
      const base = [
        ...prev.filter((id) => allIds.includes(id)),
        ...allIds.filter((id) => !prev.includes(id)),
      ];
      const from = base.indexOf(draggedId);
      const to = base.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...base];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: "72px" }} />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div
        style={{
          border: "1px dashed var(--border)",
          borderRadius: "14px",
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          No accounts yet.
        </p>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "13px",
            marginTop: "4px",
          }}
        >
          Open one above to get started.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {groupedAccounts.map((group) => (
        <div
          key={group.id}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "10px",
          }}
        >
          <div style={{ padding: "6px 4px 2px" }}>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#f59e0b",
                marginBottom: "4px",
              }}
            >
              {group.title}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {group.description}
            </p>
          </div>

          {group.accounts.map((acc) => {
            const meta = ACCOUNT_TYPE_META[acc.accountType];
            const isDragging = draggingId === acc.id;
            const isDragOver = dragOverId === acc.id;

            return (
              <div
                key={acc.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  draggingGroupId.current = group.id;
                  setDraggingId(acc.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                  draggingGroupId.current = null;
                }}
                onDragOver={(e) => {
                  if (draggingGroupId.current !== group.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (acc.id !== draggingId) setDragOverId(acc.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (
                    draggingId &&
                    draggingId !== acc.id &&
                    draggingGroupId.current === group.id
                  ) {
                    handleReorder(draggingId, acc.id);
                  }
                  setDragOverId(null);
                }}
                className="fade-up"
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: isDragOver ? "var(--surface-2)" : "var(--surface-1)",
                  border: `1px solid ${isDragOver ? "#f59e0b66" : "var(--border)"}`,
                  borderRadius: "12px",
                  transition: "border-color 0.15s, background 0.15s, opacity 0.15s",
                  opacity: isDragging ? 0.4 : 1,
                  outline: isDragOver ? "1px solid #f59e0b44" : "none",
                }}
              >
                {/* Drag handle */}
                <div
                  title="Drag to reorder"
                  style={{
                    padding: "0 12px",
                    alignSelf: "stretch",
                    display: "flex",
                    alignItems: "center",
                    cursor: isDragging ? "grabbing" : "grab",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                    opacity: 0.45,
                  }}
                >
                  <svg
                    width="10"
                    height="16"
                    viewBox="0 0 10 16"
                    fill="currentColor"
                  >
                    <circle cx="2.5" cy="2.5" r="1.5" />
                    <circle cx="7.5" cy="2.5" r="1.5" />
                    <circle cx="2.5" cy="7.5" r="1.5" />
                    <circle cx="7.5" cy="7.5" r="1.5" />
                    <circle cx="2.5" cy="12.5" r="1.5" />
                    <circle cx="7.5" cy="12.5" r="1.5" />
                  </svg>
                </div>

                <Link
                  href={`/account/${acc.id}`}
                  draggable={false}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px 16px 0",
                    flex: 1,
                    textDecoration: "none",
                    color: "inherit",
                    minWidth: 0,
                  }}
                  onMouseEnter={(e) => {
                    const card = e.currentTarget.parentElement;
                    if (card && !isDragOver) {
                      card.style.borderColor = "var(--border-hover)";
                      card.style.background = "var(--surface-2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    const card = e.currentTarget.parentElement;
                    if (card && !isDragOver) {
                      card.style.borderColor = "var(--border)";
                      card.style.background = "var(--surface-1)";
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        background: meta.soft,
                        border: `1px solid ${meta.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "15px",
                        fontWeight: 700,
                        color: meta.color,
                        flexShrink: 0,
                      }}
                    >
                      {(acc.nickname ?? acc.ownerName)[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: 600,
                          fontSize: "14px",
                          marginBottom: acc.nickname ? "1px" : "3px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {acc.nickname ?? acc.ownerName}
                      </p>
                      {acc.nickname && (
                        <p
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            marginBottom: "3px",
                          }}
                        >
                          {acc.ownerName}
                        </p>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: meta.soft,
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                        {acc.frozen && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "#3b82f622",
                              color: "#60a5fa",
                            }}
                          >
                            FROZEN
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      className="num"
                      style={{
                        fontSize: "15px",
                        fontWeight: 500,
                        color: meta.color,
                      }}
                    >
                      {formatCurrency(acc.balance)}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="var(--text-muted)"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
