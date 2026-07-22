"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Star, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { Account } from "@/lib/api";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_GROUPS, sumSignedBalances, accountDisplayName } from "@/lib/account-view";
import { EmptyState } from "@/components/EmptyState";

const PIN_COLOR = "#f59e0b";
const NEGATIVE_COLOR = "#ef4444";

interface AccountsTableProps {
  accounts: Account[];
  loading: boolean;
  /** When true, rows can be dragged to set the manual order; disabled while an automatic sort is active. */
  draggable: boolean;
  pinnedIds: Set<string>;
  hiddenIds: Set<string>;
  onTogglePin: (id: string) => void;
  onToggleHide: (id: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
}

/**
 * Account list grouped into Cash / Registered / Credit sections, each with a running subtotal.
 * Rows carry pin and hide controls; when `draggable` is on they can be reordered within a group.
 */
export function AccountsTable({
  accounts,
  loading,
  draggable,
  pinnedIds,
  hiddenIds,
  onTogglePin,
  onToggleHide,
  onReorder,
}: AccountsTableProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const draggingGroupId = useRef<string | null>(null);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[1, 2, 3].map((index) => (
          <div key={index} className="skeleton" style={{ height: "72px" }} />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="No accounts match"
        description="Try clearing a filter or search term to see more of your accounts."
      />
    );
  }

  const groups = ACCOUNT_GROUPS.map((group) => ({
    ...group,
    accounts: accounts.filter((account) => group.types.includes(account.accountType)),
  })).filter((group) => group.accounts.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {groups.map((group) => {
        const subtotal = sumSignedBalances(group.accounts);
        return (
          <div
            key={group.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "12px",
                padding: "6px 4px 2px",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#3b82f6",
                    marginBottom: "4px",
                  }}
                >
                  {group.title}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>{group.description}</p>
              </div>
              <span
                className="num"
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: subtotal < 0 ? NEGATIVE_COLOR : "var(--text-primary)",
                  flexShrink: 0,
                }}
              >
                {formatCurrency(subtotal)}
              </span>
            </div>

            {group.accounts.map((account) => {
              const meta = ACCOUNT_TYPE_META[account.accountType];
              const isDragging = draggingId === account.id;
              const isDragOver = dragOverId === account.id;
              const isPinned = pinnedIds.has(account.id);
              const isHidden = hiddenIds.has(account.id);

              return (
                <div
                  key={account.id}
                  draggable={draggable}
                  onDragStart={(event) => {
                    if (!draggable) return;
                    event.dataTransfer.effectAllowed = "move";
                    draggingGroupId.current = group.id;
                    setDraggingId(account.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDragOverId(null);
                    draggingGroupId.current = null;
                  }}
                  onDragOver={(event) => {
                    if (!draggable || draggingGroupId.current !== group.id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (account.id !== draggingId) setDragOverId(account.id);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setDragOverId(null);
                    }
                  }}
                  onDrop={(event) => {
                    if (!draggable) return;
                    event.preventDefault();
                    if (
                      draggingId &&
                      draggingId !== account.id &&
                      draggingGroupId.current === group.id
                    ) {
                      onReorder(draggingId, account.id);
                    }
                    setDragOverId(null);
                  }}
                  className="lift"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: isDragOver ? "var(--surface-2)" : "var(--surface-1)",
                    border: `1px solid ${isDragOver ? "#3b82f666" : "var(--border)"}`,
                    borderRadius: "12px",
                    transition:
                      "border-color 0.2s, background 0.2s, opacity 0.15s, box-shadow 0.2s",
                    opacity: isDragging ? 0.4 : isHidden ? 0.55 : 1,
                    outline: isDragOver ? "1px solid #3b82f644" : "none",
                  }}
                >
                  <button
                    type="button"
                    className="press"
                    onClick={() => onTogglePin(account.id)}
                    aria-pressed={isPinned}
                    aria-label={isPinned ? "Unpin from dashboard" : "Pin to dashboard"}
                    title={isPinned ? "Unpin from dashboard" : "Pin to dashboard"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      alignSelf: "stretch",
                      padding: "0 10px 0 14px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: isPinned ? PIN_COLOR : "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    <Star size={16} fill={isPinned ? PIN_COLOR : "none"} />
                  </button>

                  {draggable && (
                    <div
                      title="Drag to reorder"
                      style={{
                        padding: "0 8px",
                        alignSelf: "stretch",
                        display: "flex",
                        alignItems: "center",
                        cursor: isDragging ? "grabbing" : "grab",
                        color: "var(--text-muted)",
                        flexShrink: 0,
                        opacity: 0.45,
                      }}
                    >
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2.5" cy="2.5" r="1.5" />
                        <circle cx="7.5" cy="2.5" r="1.5" />
                        <circle cx="2.5" cy="7.5" r="1.5" />
                        <circle cx="7.5" cy="7.5" r="1.5" />
                        <circle cx="2.5" cy="12.5" r="1.5" />
                        <circle cx="7.5" cy="12.5" r="1.5" />
                      </svg>
                    </div>
                  )}

                  <Link
                    href={`/account/${account.id}`}
                    draggable={false}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: draggable ? "16px 8px 16px 0" : "16px 8px 16px 4px",
                      flex: 1,
                      textDecoration: "none",
                      color: "inherit",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}
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
                        {accountDisplayName(account)[0].toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontWeight: 600,
                            fontSize: "14px",
                            marginBottom: account.nickname ? "1px" : "3px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {accountDisplayName(account)}
                        </p>
                        {account.nickname && (
                          <p
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted)",
                              marginBottom: "3px",
                            }}
                          >
                            {account.ownerName}
                          </p>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                          {account.frozen && (
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
                          {account.isLinked && account.institutionName && (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "#3b82f618",
                                color: "#3b82f6",
                              }}
                            >
                              Linked · {account.institutionName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span
                      className="num"
                      style={{
                        fontSize: "15px",
                        fontWeight: 500,
                        color: account.accountType === "CREDIT" ? NEGATIVE_COLOR : meta.color,
                        flexShrink: 0,
                        paddingLeft: "12px",
                      }}
                    >
                      {formatCurrency(account.balance)}
                    </span>
                  </Link>

                  <button
                    type="button"
                    className="press"
                    onClick={() => onToggleHide(account.id)}
                    aria-pressed={isHidden}
                    aria-label={isHidden ? "Unhide account" : "Hide account"}
                    title={isHidden ? "Unhide account" : "Hide account"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      alignSelf: "stretch",
                      padding: "0 16px",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
