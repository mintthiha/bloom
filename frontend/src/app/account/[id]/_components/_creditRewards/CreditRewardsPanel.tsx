"use client";
import { useState, useMemo } from "react";
import type { Transaction } from "@/lib/api";
import { CollapsibleCard } from "@/components/collapsible-card";
import { formatCurrency } from "@/lib/format";
import { ACCOUNT_TYPE_META } from "@/lib/constants/account";
import { inputStyle } from "@/lib/styles/input";
import { CARD_PROGRAMS, computePointsByCategory, computeTotalPoints } from "./credit-rewards-math";
import { loadCustomPrograms, saveCustomPrograms, isCustomProgram } from "./custom-programs-store";
import { CustomProgramForm } from "./CustomProgramForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

type CreditRewardsPanelProps = {
  txns: Transaction[];
};

const TOOLTIP_CONTENT_STYLE = {
  background: "#1e1e1e",
  border: "1px solid #363636",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#f0f0f0",
};

const TOOLTIP_ITEM_STYLE = { color: "rgba(255,255,255,0.68)" };

/** Formats an X-axis tick — compact number for points, dollar for cashback. */
function formatRewardTick(value: number, isCashback: boolean): string {
  if (isCashback) {
    if (value >= 1000) return `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return `$${value.toFixed(value % 1 === 0 ? 0 : 2)}`;
  }
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
}

/** Bar chart panel estimating credit card rewards by spending category. */
export function CreditRewardsPanel({ txns }: CreditRewardsPanelProps) {
  const accentColor = ACCOUNT_TYPE_META.CREDIT.color;

  const [customPrograms, setCustomPrograms] = useState(() => {
    if (typeof window === "undefined") return [];
    return loadCustomPrograms();
  });
  const [selectedProgramId, setSelectedProgramId] = useState(CARD_PROGRAMS[0].id);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPendingDelete, setIsPendingDelete] = useState(false);

  const allPrograms = useMemo(() => [...CARD_PROGRAMS, ...customPrograms], [customPrograms]);

  const selectedProgram =
    allPrograms.find((program) => program.id === selectedProgramId) ?? CARD_PROGRAMS[0];

  const charges = useMemo(
    () => txns.filter((transaction) => transaction.type === "DEPOSIT"),
    [txns]
  );

  const categoryPoints = useMemo(
    () => computePointsByCategory(charges, selectedProgram),
    [charges, selectedProgram]
  );

  const isCashback = selectedProgram.rewardType === "cashback";
  const totalPoints = computeTotalPoints(categoryPoints);
  const totalSpending = charges.reduce((sum, transaction) => sum + transaction.amount, 0);
  const hasData = categoryPoints.length > 0;
  const chartHeight = Math.max(180, categoryPoints.length * 44);

  /** Persists and applies a newly created custom program, then selects it. */
  function handleSaveCustomProgram(program: Parameters<typeof saveCustomPrograms>[0][number]) {
    const updated = [...customPrograms, program];
    saveCustomPrograms(updated);
    setCustomPrograms(updated);
    setSelectedProgramId(program.id);
    setIsFormOpen(false);
  }

  /** Removes the selected custom program, falls back to the first built-in, and confirms via toast. */
  function handleDeleteCustomProgram() {
    const updated = customPrograms.filter((p) => p.id !== selectedProgramId);
    saveCustomPrograms(updated);
    setCustomPrograms(updated);
    setSelectedProgramId(CARD_PROGRAMS[0].id);
    setIsPendingDelete(false);
    toast.success("Template deleted");
  }

  return (
    <>
      <CollapsibleCard
        eyebrow="Credit Card"
        title="Rewards Estimator"
        defaultCollapsed={false}
        style={{ borderTop: `3px solid ${accentColor}` }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Program selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="rewards-card-program"
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Card Program
            </label>
            <select
              id="rewards-card-program"
              value={selectedProgramId}
              onChange={(event) => {
                setSelectedProgramId(event.target.value);
                setIsFormOpen(false);
              }}
              style={inputStyle}
            >
              <optgroup label="Built-in Programs">
                {CARD_PROGRAMS.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </optgroup>
              {customPrograms.length > 0 && (
                <optgroup label="My Templates">
                  {customPrograms.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                {selectedProgram.description}
              </p>
              {isCustomProgram(selectedProgramId) && !isFormOpen && (
                <button
                  type="button"
                  onClick={() => setIsPendingDelete(true)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  Delete template
                </button>
              )}
            </div>

            {!isFormOpen ? (
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: accentColor,
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  padding: 0,
                  alignSelf: "flex-start",
                  opacity: 0.8,
                }}
              >
                + New template
              </button>
            ) : (
              <CustomProgramForm
                onSave={handleSaveCustomProgram}
                onCancel={() => setIsFormOpen(false)}
              />
            )}
          </div>

          {!hasData ? (
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
              No charges in the current view. add transactions to see estimated rewards, or change
              the date.
            </p>
          ) : (
            <>
              <div>
                <p
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    letterSpacing: "-0.4px",
                    color: accentColor,
                  }}
                >
                  {isCashback ? formatCurrency(totalPoints) : `${totalPoints.toLocaleString()} pts`}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  Estimated total · {charges.length} charge{charges.length !== 1 ? "s" : ""} ·{" "}
                  {formatCurrency(totalSpending)} spent
                </p>
              </div>

              <div>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginBottom: "12px",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {isCashback ? "Cash Back by Category" : "Points by Category"}
                </p>
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    layout="vertical"
                    data={categoryPoints}
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--chart-grid)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatRewardTick(v, isCashback)}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                      tickLine={false}
                      axisLine={false}
                      width={96}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      labelStyle={{
                        color: "#f0f0f0",
                        fontWeight: 600,
                        marginBottom: "4px",
                      }}
                      formatter={(value, _name, props) => {
                        const reward = isCashback
                          ? formatCurrency(Number(value))
                          : `${Number(value).toLocaleString()} pts`;
                        const rate = isCashback
                          ? `${props.payload.multiplier}%`
                          : `${props.payload.multiplier}x`;
                        return [
                          `${reward} · ${rate} · ${formatCurrency(props.payload.spending)}`,
                          isCashback ? "Estimated cash back" : "Estimated points",
                        ];
                      }}
                    />
                    <Bar dataKey="points" radius={[0, 4, 4, 0]}>
                      {categoryPoints.map((entry, index) => {
                        const isBonus =
                          (selectedProgram.categoryMultipliers[entry.category] ?? 0) >
                          selectedProgram.baseRate;
                        return (
                          <Cell
                            key={index}
                            fill={accentColor}
                            fillOpacity={isBonus ? 0.85 : 0.35}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {Object.keys(selectedProgram.categoryMultipliers).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {Object.entries(selectedProgram.categoryMultipliers).map(
                    ([category, multiplier]) => (
                      <div
                        key={category}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "6px",
                          background: `${accentColor}18`,
                          border: `1px solid ${accentColor}33`,
                          fontSize: "12px",
                          color: accentColor,
                          fontWeight: 600,
                        }}
                      >
                        {isCashback ? `${multiplier}%` : `${multiplier}x`} {category}
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div
          style={{
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid var(--border)",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          Estimates are based on categorized charges in the current date range. Actual rewards vary
          by card issuer.
        </div>
      </CollapsibleCard>

      <AlertDialog
        open={isPendingDelete}
        onOpenChange={(open) => !open && setIsPendingDelete(false)}
      >
        <AlertDialogContent>
          <div style={{ padding: "12px 14px" }}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete template?</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{selectedProgram.name}&rdquo; will be permanently removed from your saved
                templates.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" onClick={() => setIsPendingDelete(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction type="button" onClick={handleDeleteCustomProgram}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
