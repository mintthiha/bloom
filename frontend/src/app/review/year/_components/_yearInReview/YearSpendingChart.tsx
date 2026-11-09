"use client";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { YearInReview } from "@/lib/api";
import { ChartTooltip } from "@/components/chart-tooltip";
import { formatMonthName, formatShortMonthName } from "../../../_components/review-month";
import { formatAxisDollars } from "./year-recap";

/**
 * Spending per month across the year — a single series, so the title names it and no legend is
 * needed. Matches the budget daily-spending chart: amber bars, rounded tops, recessive axes.
 */
export function YearSpendingChart({ months }: { months: YearInReview["months"] }) {
  return (
    <figure style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <figcaption style={{ fontSize: "13px", fontWeight: 700 }}>Spending by month</figcaption>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            tickFormatter={(month: string) => formatShortMonthName(month)}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatAxisDollars}
            width={44}
          />
          <Tooltip
            content={
              <ChartTooltip
                nameMap={{ spending: "Spent" }}
                labelFormatter={(month) => formatMonthName(String(month), true)}
              />
            }
            cursor={{ fill: "var(--chart-cursor)" }}
          />
          <Bar
            dataKey="spending"
            fill="var(--brand-accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
      {/* Table view of the same numbers, for screen readers and anyone who prefers figures. */}
      <table className="sr-only">
        <caption>Spending by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Spent</th>
            <th scope="col">Income</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <th scope="row">{formatMonthName(month.month)}</th>
              <td>{month.spending.toFixed(2)}</td>
              <td>{month.income.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
