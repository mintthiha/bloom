"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { inputStyle } from "@/lib/styles/input";
import type { CardProgram } from "./credit-rewards-math";
import { generateCustomProgramId } from "./custom-programs-store";

const SUGGESTED_CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Shopping",
  "Entertainment",
  "Travel",
  "Gas",
  "Health",
  "Utilities",
  "Subscriptions",
];

type CategoryRow = { rowId: string; category: string; rate: string };

type CustomProgramFormProps = {
  onSave: (program: CardProgram) => void;
  onCancel: () => void;
};

const labelStyle: CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

/** Generates a stable key for a new blank category row. */
function makeRow(): CategoryRow {
  return { rowId: `${Date.now()}-${Math.random()}`, category: "", rate: "" };
}

/**
 * Builds a human-readable description for a program based on its rates.
 * Shows up to 3 category bonuses followed by the base rate fallback.
 */
function buildDescription(
  rewardType: "points" | "cashback",
  baseRate: number,
  categoryMultipliers: Record<string, number>
): string {
  const suffix = rewardType === "cashback" ? "%" : "x";
  const entries = Object.entries(categoryMultipliers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (entries.length === 0) {
    return rewardType === "cashback"
      ? `${baseRate}% cash back on all purchases`
      : `${baseRate}${suffix} pts per $1 on all purchases`;
  }

  const parts = entries.map(([cat, rate]) => `${rate}${suffix} ${cat}`);
  parts.push(`${baseRate}${suffix} all`);
  return parts.join(" · ");
}

/** Form for creating a custom reward program template with per-category bonus rates. */
export function CustomProgramForm({ onSave, onCancel }: CustomProgramFormProps) {
  const accentColor = ACCOUNT_TYPE_META.CREDIT.color;
  const [name, setName] = useState("");
  const [rewardType, setRewardType] = useState<"points" | "cashback">("points");
  const [baseRate, setBaseRate] = useState("");
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const rateLabel = rewardType === "cashback" ? "% back per $1" : "pts per $1";

  /** Appends a blank category row. */
  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  /** Removes the row with the given rowId. */
  function removeRow(rowId: string) {
    setRows((prev) => prev.filter((row) => row.rowId !== rowId));
  }

  /** Updates a single field on a category row by rowId. */
  function updateRow(rowId: string, field: "category" | "rate", value: string) {
    setRows((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)));
  }

  /** Validates fields, builds the CardProgram, and calls onSave. */
  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    const parsedBase = parseFloat(baseRate);
    if (isNaN(parsedBase) || parsedBase <= 0) {
      setError("Base rate must be a positive number.");
      return;
    }

    const categoryMultipliers: Record<string, number> = {};
    for (const row of rows) {
      if (!row.category.trim() && !row.rate.trim()) continue;
      if (!row.category.trim()) {
        setError("Each bonus row needs a category name.");
        return;
      }
      const parsedRate = parseFloat(row.rate);
      if (isNaN(parsedRate) || parsedRate <= 0) {
        setError(`Rate for "${row.category}" must be a positive number.`);
        return;
      }
      categoryMultipliers[row.category.trim()] = parsedRate;
    }

    onSave({
      id: generateCustomProgramId(),
      name: trimmedName,
      description: buildDescription(rewardType, parsedBase, categoryMultipliers),
      rewardType,
      baseRate: parsedBase,
      categoryMultipliers,
    });
  }

  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: `1px solid ${accentColor}33`,
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
        New Template
      </p>

      {/* Name */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label htmlFor="custom-program-name" style={labelStyle}>
          Name
        </label>
        <input
          id="custom-program-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. My Rewards Card"
          style={inputStyle}
        />
      </div>

      {/* Reward type toggle */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={labelStyle}>Reward Type</span>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["points", "cashback"] as const).map((type) => {
            const isActive = rewardType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setRewardType(type)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: isActive ? `1px solid ${accentColor}55` : "1px solid var(--border)",
                  background: isActive ? `${accentColor}18` : "transparent",
                  color: isActive ? accentColor : "var(--text-muted)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: "0.02em",
                  transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                }}
              >
                {type === "points" ? "Points" : "Cash Back"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Base rate */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label htmlFor="custom-program-base-rate" style={labelStyle}>
          Base Rate
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            id="custom-program-base-rate"
            type="number"
            value={baseRate}
            onChange={(event) => setBaseRate(event.target.value)}
            min="0"
            step="0.1"
            placeholder="1"
            style={{ ...inputStyle, width: "90px" }}
          />
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{rateLabel}</span>
        </div>
      </div>

      {/* Category bonus rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={labelStyle}>Category Bonuses (optional)</span>
        <datalist id="custom-program-categories">
          {SUGGESTED_CATEGORIES.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>

        {rows.map((row) => (
          <div key={row.rowId} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              list="custom-program-categories"
              value={row.category}
              onChange={(event) => updateRow(row.rowId, "category", event.target.value)}
              placeholder="Category"
              style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: "13px" }}
            />
            <input
              type="number"
              value={row.rate}
              onChange={(event) => updateRow(row.rowId, "rate", event.target.value)}
              min="0"
              step="0.1"
              placeholder={rewardType === "cashback" ? "%" : "×"}
              style={{ ...inputStyle, width: "72px", padding: "8px 12px", fontSize: "13px" }}
            />
            <button
              type="button"
              onClick={() => removeRow(row.rowId)}
              aria-label="Remove category"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "18px",
                lineHeight: 1,
                padding: "4px",
                fontFamily: "inherit",
              }}
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          style={{
            background: "transparent",
            border: "1px dashed var(--border)",
            borderRadius: "6px",
            color: "var(--text-muted)",
            fontSize: "12px",
            fontWeight: 600,
            padding: "6px 12px",
            cursor: "pointer",
            fontFamily: "inherit",
            alignSelf: "flex-start",
          }}
        >
          + Add category
        </button>
      </div>

      {error && <p style={{ fontSize: "12px", color: "#f87171", margin: 0 }}>{error}</p>}

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: `1px solid ${accentColor}55`,
            background: `${accentColor}18`,
            color: accentColor,
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Save Template
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
