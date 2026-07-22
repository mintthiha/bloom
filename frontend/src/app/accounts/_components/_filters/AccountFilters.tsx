"use client";

import { Search, Eye, EyeOff } from "lucide-react";
import { AccountType } from "@/lib/api";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";

// Type chips in the same order as the list groups, so the filter row reads top-to-bottom like the list.
const FILTERABLE_TYPES: AccountType[] = ["CHEQUING", "SAVINGS", "TFSA", "RRSP", "FHSA", "CREDIT"];

interface AccountFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeTypes: Set<AccountType>;
  onToggleType: (type: AccountType) => void;
  onClearTypes: () => void;
  hiddenCount: number;
  showHidden: boolean;
  onToggleShowHidden: () => void;
}

/** Search box, per-type filter chips, and a show/hide-hidden toggle for the accounts list. */
export function AccountFilters({
  search,
  onSearchChange,
  activeTypes,
  onToggleType,
  onClearTypes,
  hiddenCount,
  showHidden,
  onToggleShowHidden,
}: AccountFiltersProps) {
  const allActive = activeTypes.size === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ position: "relative", maxWidth: "340px" }}>
        <Search
          size={15}
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search accounts…"
          style={{
            width: "100%",
            height: "40px",
            padding: "0 12px 0 36px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            background: "var(--surface-1)",
            color: "var(--text-primary)",
            fontSize: "14px",
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="nav-item"
          onClick={onClearTypes}
          aria-pressed={allActive}
          style={chipStyle(allActive, "#3b82f6")}
        >
          All
        </button>
        {FILTERABLE_TYPES.map((type) => {
          const meta = ACCOUNT_TYPE_META[type];
          const active = activeTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              className="nav-item"
              onClick={() => onToggleType(type)}
              aria-pressed={active}
              style={chipStyle(active, meta.color)}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "9999px",
                  background: meta.color,
                  flexShrink: 0,
                }}
              />
              {meta.label}
            </button>
          );
        })}

        {hiddenCount > 0 && (
          <button
            type="button"
            className="nav-item"
            onClick={onToggleShowHidden}
            aria-pressed={showHidden}
            style={{ ...chipStyle(showHidden, "#3b82f6"), marginLeft: "auto" }}
          >
            {showHidden ? <EyeOff size={13} /> : <Eye size={13} />}
            {showHidden ? "Hide hidden" : `Show hidden (${hiddenCount})`}
          </button>
        )}
      </div>
    </div>
  );
}

/** Shared pill styling for filter chips; `active` fills the chip with a tint of its accent color. */
function chipStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "32px",
    padding: "0 12px",
    borderRadius: "9999px",
    border: active ? `1px solid ${accent}66` : "1px solid var(--border)",
    background: active ? `${accent}1a` : "var(--surface-1)",
    color: active ? accent : "var(--text-secondary)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  };
}
