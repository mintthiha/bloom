"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ManualEntry, ManualEntryType } from "@/lib/api";
import { inputStyle } from "@/lib/styles/input";
import { todayString } from "../manual-entry-format";

/** Common liabilities and assets offered as name suggestions while typing. */
const SUGGESTED_LIABILITIES = [
  "Student Loan",
  "Mortgage",
  "Car Loan",
  "Personal Loan",
  "Line of Credit",
];
const SUGGESTED_ASSETS = ["Home", "Vehicle", "Other Bank Account", "Investment Account"];

/** Form to add a new manual asset or liability with an optional as-of date. */
export function AddEntryForm({ onCreated }: { onCreated: (entry: ManualEntry) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ManualEntryType>("LIABILITY");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestions = type === "LIABILITY" ? SUGGESTED_LIABILITIES : SUGGESTED_ASSETS;

  /** Submits the new manual entry and refreshes the list on success. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!name.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Name and a positive amount are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await api.createManualEntry({
        name: name.trim(),
        type,
        amount: parsedAmount,
        date: date || null,
      });
      onCreated(created);
      setName("");
      setAmount("");
      setDate(todayString());
      toast.success(`${created.name} added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        padding: "24px",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--brand-accent-text)",
          marginBottom: "16px",
        }}
      >
        Add entry
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label
            htmlFor="manual-entry-name"
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            Name
          </label>
          <input
            id="manual-entry-name"
            style={{ ...inputStyle, fontSize: "14px" }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Student Loan"
            maxLength={100}
            list="manual-entry-suggestions"
          />
          <datalist id="manual-entry-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 110px minmax(160px, 1fr)",
            gap: "12px",
          }}
        >
          <div>
            <label
              htmlFor="manual-entry-amount"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Amount
            </label>
            <input
              id="manual-entry-amount"
              style={{ ...inputStyle, fontSize: "14px" }}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label
              htmlFor="manual-entry-type"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Type
            </label>
            <select
              id="manual-entry-type"
              style={{ ...inputStyle, fontSize: "14px" }}
              value={type}
              onChange={(e) => setType(e.target.value as ManualEntryType)}
            >
              <option value="LIABILITY">Liability</option>
              <option value="ASSET">Asset</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="manual-entry-date"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              As of date
            </label>
            <input
              id="manual-entry-date"
              style={{ ...inputStyle, fontSize: "14px", paddingRight: "6px" }}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="press"
            disabled={isSubmitting}
            style={{
              background: "var(--brand-accent)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "Adding…" : "Add entry"}
          </button>
        </div>
      </div>
    </form>
  );
}
