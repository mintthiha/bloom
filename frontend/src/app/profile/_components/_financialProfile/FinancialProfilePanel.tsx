"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, PayFrequency, PrimaryFinancialGoal } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { inputStyle as baseInputStyle } from "@/lib/styles/input";
import {
  PAY_FREQUENCY_OPTIONS,
  PRIMARY_FINANCIAL_GOAL_OPTIONS,
  describePayCycle,
} from "@/lib/financial-profile";

/**
 * Profile-page card for the cashflow details Bloom personalizes around:
 * take-home income, pay cycle, and the user's headline financial goal.
 */
export function FinancialProfilePanel() {
  const [monthlyTakeHomeIncome, setMonthlyTakeHomeIncome] = useState("");
  const [payFrequency, setPayFrequency] = useState<PayFrequency | "">("");
  const [nextPayday, setNextPayday] = useState("");
  const [primaryFinancialGoal, setPrimaryFinancialGoal] = useState<PrimaryFinancialGoal | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /** Loads the saved financial details on mount. */
  useEffect(() => {
    let cancelled = false;
    async function loadFinancialProfile() {
      try {
        const profile = await api.getProfile();
        if (!cancelled && profile) {
          setMonthlyTakeHomeIncome(profile.monthlyTakeHomeIncome?.toString() ?? "");
          setPayFrequency(profile.payFrequency ?? "");
          setNextPayday(profile.nextPayday ?? "");
          setPrimaryFinancialGoal(profile.primaryFinancialGoal ?? "");
        }
      } catch {
        // Leaves the form empty when the profile can't be loaded.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFinancialProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persists the cashflow fields, treating blank inputs as cleared values. */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const parsedIncome = monthlyTakeHomeIncome.trim()
        ? parseFloat(monthlyTakeHomeIncome.trim())
        : null;
      const profile = await api.updateFinancialProfile({
        monthlyTakeHomeIncome: parsedIncome,
        payFrequency: payFrequency === "" ? null : payFrequency,
        nextPayday: nextPayday.trim() ? nextPayday.trim() : null,
        primaryFinancialGoal: primaryFinancialGoal === "" ? null : primaryFinancialGoal,
      });
      setMonthlyTakeHomeIncome(profile.monthlyTakeHomeIncome?.toString() ?? "");
      setPayFrequency(profile.payFrequency ?? "");
      setNextPayday(profile.nextPayday ?? "");
      setPrimaryFinancialGoal(profile.primaryFinancialGoal ?? "");
      toast.success("Financial profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save financial profile");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { ...baseInputStyle, borderRadius: "10px", padding: "12px 14px" };

  const sectionLabelStyle = {
    display: "block" as const,
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "8px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  };

  const hintStyle = {
    fontSize: "12px",
    color: "var(--text-muted)",
    marginTop: "8px",
  };

  const selectedGoal = PRIMARY_FINANCIAL_GOAL_OPTIONS.find(
    (option) => option.value === primaryFinancialGoal
  );
  const payCycleSummary = describePayCycle(
    monthlyTakeHomeIncome.trim() ? parseFloat(monthlyTakeHomeIncome.trim()) : null,
    payFrequency === "" ? null : payFrequency,
    nextPayday.trim() ? nextPayday.trim() : null,
    new Date()
  );

  return (
    <CollapsibleCard
      className="fade-up"
      eyebrow="Financial Profile"
      title="How your money comes in"
      description="Tell Bloom your pay cycle so your dashboard can speak in paycheques, not just months."
      style={{ marginTop: "20px" }}
    >
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="skeleton" style={{ height: "44px" }} />
          <div className="skeleton" style={{ height: "44px" }} />
          <div className="skeleton" style={{ height: "44px" }} />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div>
            <label htmlFor="financial-monthly-income" style={sectionLabelStyle}>
              Monthly Take-Home Income
            </label>
            <input
              id="financial-monthly-income"
              type="number"
              value={monthlyTakeHomeIncome}
              onChange={(e) => setMonthlyTakeHomeIncome(e.target.value)}
              placeholder="e.g. 3750"
              min={0}
              step="0.01"
              style={inputStyle}
            />
            <p style={hintStyle}>
              What actually lands in your account each month, after tax and deductions.
            </p>
          </div>

          <div>
            <label htmlFor="financial-pay-frequency" style={sectionLabelStyle}>
              Pay Frequency
            </label>
            <select
              id="financial-pay-frequency"
              value={payFrequency}
              onChange={(e) => setPayFrequency(e.target.value as PayFrequency | "")}
              style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
            >
              <option value="">How often are you paid?</option>
              {PAY_FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="financial-next-payday" style={sectionLabelStyle}>
              Next Payday
            </label>
            <input
              id="financial-next-payday"
              type="date"
              value={nextPayday}
              onChange={(e) => setNextPayday(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            />
            <p style={hintStyle}>
              Bloom rolls this forward automatically, so you only set it once.
            </p>
          </div>

          <div>
            <label htmlFor="financial-primary-goal" style={sectionLabelStyle}>
              Primary Goal
            </label>
            <select
              id="financial-primary-goal"
              value={primaryFinancialGoal}
              onChange={(e) => setPrimaryFinancialGoal(e.target.value as PrimaryFinancialGoal | "")}
              style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
            >
              <option value="">What are you working toward?</option>
              {PRIMARY_FINANCIAL_GOAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedGoal && <p style={hintStyle}>{selectedGoal.hint}</p>}
          </div>

          {payCycleSummary && (
            <p
              style={{
                background: "#f59e0b1a",
                border: "1px solid #f59e0b33",
                borderRadius: "10px",
                padding: "12px 14px",
                fontSize: "13px",
                color: "var(--text-secondary)",
              }}
            >
              {payCycleSummary}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="press"
              disabled={saving}
              style={{
                padding: "12px 20px",
                background: "#3b82f6",
                color: "#000",
                fontWeight: 700,
                fontSize: "14px",
                border: "none",
                borderRadius: "10px",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.45 : 1,
              }}
            >
              {saving ? "Saving..." : "Save financial profile"}
            </button>
          </div>
        </form>
      )}
    </CollapsibleCard>
  );
}
