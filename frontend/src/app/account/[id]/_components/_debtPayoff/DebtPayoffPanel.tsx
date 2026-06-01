"use client";
import { useState } from "react";
import type { Account } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { formatCurrency } from "@/lib/format";
import { inputStyle } from "@/lib/styles/input";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import {
  computeMinimumPayment,
  computePayoffSchedule,
  formatPayoffDuration,
  type PayoffResult,
} from "./debt-payoff-math";

type DebtPayoffPanelProps = {
  account: Account;
};

type PayoffScenarioRowProps = {
  label: string;
  monthlyPayment: number;
  result: PayoffResult;
  highlighted?: boolean;
};

/** Renders one payoff scenario row with its monthly payment, time to payoff, and total interest. */
function PayoffScenarioRow({
  label,
  monthlyPayment,
  result,
  highlighted,
}: PayoffScenarioRowProps) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "10px",
        background: highlighted ? "var(--surface-2)" : "transparent",
        border: `1px solid ${highlighted ? "var(--border)" : "transparent"}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "8px",
        }}
      >
        <p
          style={{
            fontSize: "14px",
            fontWeight: highlighted ? 600 : 500,
            color: "var(--text-primary)",
          }}
        >
          {label}
        </p>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", flexShrink: 0 }}>
          {formatCurrency(monthlyPayment)}/mo
        </p>
      </div>

      <div style={{ marginTop: "4px", fontSize: "13px", color: "var(--text-secondary)" }}>
        {result.feasible ? (
          <>
            Paid off in{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {formatPayoffDuration(result.monthsToPayoff)}
            </strong>
            {" · "}
            <strong style={{ color: "var(--text-primary)" }}>
              {formatCurrency(result.totalInterest)}
            </strong>{" "}
            total interest
          </>
        ) : (
          <span style={{ color: "#ef4444" }}>
            Payment is less than monthly interest — debt will grow, not shrink.
          </span>
        )}
      </div>
    </div>
  );
}

/** Debt payoff timeline panel for credit card accounts, showing three payment scenarios side by side. */
export function DebtPayoffPanel({ account }: DebtPayoffPanelProps) {
  const accentColor = ACCOUNT_TYPE_META.CREDIT.color;
  const [aprInput, setAprInput] = useState("19.99");
  const [monthlyPaymentInput, setMonthlyPaymentInput] = useState("");

  const balance = account.balance;
  const parsedApr = parseFloat(aprInput);
  const parsedPayment = parseFloat(monthlyPaymentInput);
  const isValidApr = !isNaN(parsedApr) && parsedApr >= 0 && parsedApr <= 100;
  const isValidPayment = !isNaN(parsedPayment) && parsedPayment > 0;
  const effectiveApr = isValidApr ? parsedApr : 19.99;

  const minimumPayment = computeMinimumPayment(balance);
  const minimumResult = computePayoffSchedule(balance, effectiveApr, minimumPayment);
  const userResult = isValidPayment
    ? computePayoffSchedule(balance, effectiveApr, parsedPayment)
    : null;
  const boostedResult = isValidPayment
    ? computePayoffSchedule(balance, effectiveApr, parsedPayment + 50)
    : null;

  const savingsVsMinimum =
    isValidPayment &&
    parsedPayment > minimumPayment &&
    minimumResult.feasible &&
    userResult?.feasible
      ? {
          monthsSaved: minimumResult.monthsToPayoff - userResult.monthsToPayoff,
          interestSaved: minimumResult.totalInterest - userResult.totalInterest,
          extraPerMonth: parsedPayment - minimumPayment,
        }
      : null;

  return (
    <CollapsibleCard
      eyebrow="Credit Card"
      title="Debt Payoff Planner"
      defaultCollapsed={false}
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      {balance <= 0 ? (
        <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          No outstanding balance — this card is paid off.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <p
              style={{
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-0.4px",
                color: accentColor,
              }}
            >
              {formatCurrency(balance)}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Current balance
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                htmlFor="debt-payoff-apr"
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Interest Rate (APR)
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="debt-payoff-apr"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={aprInput}
                  onChange={(e) => setAprInput(e.target.value)}
                  style={{ ...inputStyle, paddingRight: "30px" }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "14px",
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                >
                  %
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                htmlFor="debt-payoff-monthly-payment"
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Monthly Payment
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "14px",
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                >
                  $
                </span>
                <input
                  id="debt-payoff-monthly-payment"
                  type="number"
                  min="0"
                  step="1"
                  placeholder={String(Math.ceil(minimumPayment * 3))}
                  value={monthlyPaymentInput}
                  onChange={(e) => setMonthlyPaymentInput(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: "26px" }}
                />
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Minimum: ~{formatCurrency(minimumPayment)}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Payoff Scenarios
            </p>

            <PayoffScenarioRow
              label="Minimum payment"
              monthlyPayment={minimumPayment}
              result={minimumResult}
            />

            {isValidPayment && userResult ? (
              <>
                <PayoffScenarioRow
                  label="Your payment"
                  monthlyPayment={parsedPayment}
                  result={userResult}
                  highlighted
                />
                {boostedResult && (
                  <PayoffScenarioRow
                    label="+$50/month"
                    monthlyPayment={parsedPayment + 50}
                    result={boostedResult}
                  />
                )}
              </>
            ) : (
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  padding: "8px 14px",
                }}
              >
                Enter your monthly payment above to compare scenarios.
              </p>
            )}
          </div>

          {savingsVsMinimum &&
            savingsVsMinimum.monthsSaved > 0 &&
            savingsVsMinimum.interestSaved > 0 && (
              <div
                style={{
                  padding: "14px 16px",
                  background: "#22c55e0d",
                  border: "1px solid #22c55e33",
                  borderRadius: "10px",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  lineHeight: "1.55",
                }}
              >
                💡 Paying{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {formatCurrency(savingsVsMinimum.extraPerMonth)}/month more
                </strong>{" "}
                than the minimum saves{" "}
                <strong style={{ color: "#22c55e" }}>
                  {formatCurrency(savingsVsMinimum.interestSaved)}
                </strong>{" "}
                in interest and gets you debt-free{" "}
                <strong style={{ color: "#22c55e" }}>
                  {savingsVsMinimum.monthsSaved} month
                  {savingsVsMinimum.monthsSaved !== 1 ? "s" : ""} sooner
                </strong>
                .
              </div>
            )}
        </div>
      )}

      <div
        style={{
          marginTop: "16px",
          paddingTop: "14px",
          borderTop: "1px solid var(--border)",
          fontSize: "12px",
          color: "var(--text-muted)",
        }}
      >
        Estimates assume a fixed APR and consistent monthly payments. Actual amounts may vary.
      </div>
    </CollapsibleCard>
  );
}
