"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Account, AccountType } from "@/lib/api";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { formatCurrency } from "@/lib/format";
import { toSignedBalance, accountDisplayName, ACCOUNT_GROUPS } from "@/lib/account-view";
import { computeTreemapLayout } from "@/lib/treemap-layout";
import { CollapsibleCard } from "@/components/collapsible-card";

interface AccountsTreemapProps {
  accounts: Account[];
}

// Gap between tiles, in px, carved out of each rectangle so the map reads as distinct cards.
const TILE_GAP = 3;

/** Cuts a label to roughly fit the tile width, adding an ellipsis when it would overflow. */
function truncateToWidth(text: string, innerWidth: number): string {
  const maxChars = Math.floor(innerWidth / 7.5);
  if (maxChars <= 1) return "";
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
}

/**
 * A squarified treemap of the given accounts: each tile is sized by balance magnitude and colored by
 * type, so the accounts that move the needle dominate the view. Reacts to whatever accounts it's given
 * (filters, hidden, search), and clicking a tile opens that account.
 */
export function AccountsTreemap({ accounts }: AccountsTreemapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /** Track the container's real width so the treemap lays out in pixels rather than distorting via viewBox scaling. */
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const next = element.clientWidth;
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const height = width < 520 ? 360 : 300;

  const tiles = useMemo(() => {
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const layout = computeTreemapLayout(
      accounts.map((account) => ({ id: account.id, value: Math.abs(toSignedBalance(account)) })),
      width,
      height
    );
    return layout.map((rect) => {
      const account = byId.get(rect.id)!;
      return { rect, account, meta: ACCOUNT_TYPE_META[account.accountType] };
    });
  }, [accounts, width, height]);

  const presentTypes = useMemo(() => {
    const seen = new Set<AccountType>();
    for (const account of accounts) seen.add(account.accountType);
    return seen;
  }, [accounts]);

  if (tiles.length === 0) return null;

  // Group-color legend, shown in the card header and kept visible while the card is collapsed.
  const legend = (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
      {ACCOUNT_GROUPS.map((group) => {
        const groupColor = ACCOUNT_TYPE_META[group.types[0]].color;
        const active = group.types.some((type) => presentTypes.has(type));
        return (
          <span
            key={group.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: active ? "var(--text-secondary)" : "var(--text-muted)",
              opacity: active ? 1 : 0.5,
            }}
          >
            <span
              style={{ width: "9px", height: "9px", borderRadius: "3px", background: groupColor }}
            />
            {group.title.replace(" Accounts", "")}
          </span>
        );
      })}
    </div>
  );

  return (
    <CollapsibleCard
      eyebrow="Balance Map"
      title="Balances by account"
      description="Each tile is an account, sized by balance and colored by type."
      headerRight={legend}
    >
      <div ref={containerRef} style={{ width: "100%" }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: "block", borderRadius: "10px", overflow: "visible" }}
          role="img"
          aria-label="Treemap of account balances"
        >
          <defs>
            {Object.entries(ACCOUNT_TYPE_META).map(([type, meta]) => (
              <linearGradient key={type} id={`treemap-grad-${type}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={meta.color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={meta.color} stopOpacity={0.62} />
              </linearGradient>
            ))}
          </defs>

          {tiles.map(({ rect, account, meta }) => {
            const x = rect.x + TILE_GAP / 2;
            const y = rect.y + TILE_GAP / 2;
            const tileWidth = Math.max(0, rect.width - TILE_GAP);
            const tileHeight = Math.max(0, rect.height - TILE_GAP);
            const innerWidth = tileWidth - 20;
            const isHovered = hoveredId === account.id;
            const dimmed = hoveredId !== null && !isHovered;
            const label = truncateToWidth(accountDisplayName(account), innerWidth);
            const showLabel = tileWidth > 58 && tileHeight > 30;
            const showBalance = tileWidth > 72 && tileHeight > 50;

            return (
              <g
                key={account.id}
                onClick={() => router.push(`/account/${account.id}`)}
                onMouseEnter={() => setHoveredId(account.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  cursor: "pointer",
                  opacity: dimmed ? 0.55 : 1,
                  transition: "opacity 0.2s ease",
                }}
              >
                <title>
                  {accountDisplayName(account)} · {formatCurrency(account.balance)}
                </title>
                <rect
                  x={x}
                  y={y}
                  width={tileWidth}
                  height={tileHeight}
                  rx={8}
                  fill={`url(#treemap-grad-${account.accountType})`}
                  stroke={isHovered ? "#ffffff" : "transparent"}
                  strokeWidth={isHovered ? 2 : 0}
                />
                {showLabel && (
                  <text
                    x={x + 10}
                    y={y + 21}
                    fill="#ffffff"
                    fontSize={13}
                    fontWeight={700}
                    style={{ pointerEvents: "none" }}
                  >
                    {label}
                  </text>
                )}
                {showBalance && (
                  <text
                    x={x + 10}
                    y={y + 39}
                    fill="#ffffff"
                    fontSize={11.5}
                    fontWeight={500}
                    opacity={0.85}
                    className="num"
                    style={{ pointerEvents: "none" }}
                  >
                    {formatCurrency(account.balance)}
                  </text>
                )}
                {showLabel && (
                  <text
                    x={x + 10}
                    y={y + tileHeight - 9}
                    fill="#ffffff"
                    fontSize={9.5}
                    fontWeight={700}
                    letterSpacing="0.06em"
                    opacity={0.75}
                    style={{ pointerEvents: "none", textTransform: "uppercase" }}
                  >
                    {tileHeight > 66 ? meta.label.toUpperCase() : ""}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </CollapsibleCard>
  );
}
