"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { CSSProperties } from "react";

interface DashboardSkeletonProps {
  dashboardColumns: string;
}

const cardBase: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: "14px",
  padding: "24px",
};

/** Skeleton for the six stat tiles at the top of the dashboard. */
function StatsRowSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px",
        marginBottom: "36px",
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <Skeleton style={{ height: "11px", width: "55%", marginBottom: "14px" }} />
          <Skeleton style={{ height: "22px", width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the GoalWidget card (header + progress bar). */
function GoalWidgetSkeleton() {
  return (
    <div style={{ ...cardBase, padding: "20px 24px", marginBottom: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <Skeleton style={{ height: "11px", width: "32px" }} />
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Skeleton style={{ height: "26px", width: "120px", borderRadius: "7px" }} />
          <Skeleton style={{ height: "22px", width: "60px", borderRadius: "6px" }} />
          <Skeleton style={{ height: "24px", width: "24px", borderRadius: "6px" }} />
        </div>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}
      >
        <Skeleton style={{ height: "15px", width: "150px" }} />
        <Skeleton style={{ height: "14px", width: "42px", borderRadius: "4px" }} />
        <Skeleton style={{ height: "13px", width: "80px" }} />
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}
      >
        <Skeleton style={{ flex: 1, height: "8px", borderRadius: "999px" }} />
        <Skeleton style={{ height: "13px", width: "30px", flexShrink: 0 }} />
      </div>
      <Skeleton style={{ height: "12px", width: "140px" }} />
    </div>
  );
}

/** Skeleton for the FinancialHealthScore card (big score display + five sub-score rows). */
function FinancialHealthSkeleton() {
  return (
    <div style={{ ...cardBase, marginBottom: "32px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <Skeleton style={{ height: "11px", width: "120px" }} />
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <Skeleton style={{ height: "18px", width: "28px" }} />
          <Skeleton style={{ height: "20px", width: "34px", borderRadius: "5px" }} />
          <Skeleton style={{ height: "20px", width: "20px", borderRadius: "6px" }} />
        </div>
      </div>
      <div
        style={{
          textAlign: "center",
          paddingBottom: "20px",
          marginBottom: "20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Skeleton
          style={{ height: "64px", width: "80px", margin: "0 auto 8px", borderRadius: "8px" }}
        />
        <Skeleton style={{ height: "16px", width: "110px", margin: "0 auto 4px" }} />
        <Skeleton style={{ height: "11px", width: "80px", margin: "0 auto 14px" }} />
        <Skeleton
          style={{ height: "8px", width: "240px", margin: "0 auto", borderRadius: "999px" }}
        />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ marginBottom: "18px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            <Skeleton style={{ height: "13px", width: "38%" }} />
            <Skeleton style={{ height: "13px", width: "40px" }} />
          </div>
          <Skeleton style={{ height: "6px", borderRadius: "999px", marginBottom: "5px" }} />
          <Skeleton style={{ height: "12px", width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the InsightsCard (eyebrow + three insight rows). */
function InsightsCardSkeleton() {
  return (
    <div style={{ ...cardBase, marginBottom: "32px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
        }}
      >
        <Skeleton style={{ height: "11px", width: "110px" }} />
        <Skeleton style={{ height: "20px", width: "20px", borderRadius: "6px" }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
            padding: "12px 0",
            borderBottom: i < 3 ? "1px solid var(--border)" : "none",
          }}
        >
          <Skeleton
            style={{ width: "3px", height: "36px", borderRadius: "2px", flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <Skeleton style={{ height: "13px", width: "80%", marginBottom: "6px" }} />
            <Skeleton style={{ height: "12px", width: "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the Monthly Snapshot and Budgets side-by-side cards. */
function SnapshotAndBudgetsSkeleton({ dashboardColumns }: { dashboardColumns: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: dashboardColumns,
        gap: "20px",
        alignItems: "start",
        marginBottom: "32px",
      }}
    >
      <div style={cardBase}>
        <Skeleton style={{ height: "11px", width: "130px", marginBottom: "10px" }} />
        <Skeleton style={{ height: "26px", width: "50%", marginBottom: "6px" }} />
        <Skeleton style={{ height: "12px", width: "40%", marginBottom: "20px" }} />
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: "var(--surface-2)",
                borderRadius: "10px",
                padding: "12px",
              }}
            >
              <Skeleton style={{ height: "10px", width: "65%", marginBottom: "8px" }} />
              <Skeleton style={{ height: "16px", width: "80%" }} />
            </div>
          ))}
        </div>
      </div>

      <div style={cardBase}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <Skeleton style={{ height: "11px", width: "70px" }} />
          <Skeleton style={{ height: "22px", width: "22px", borderRadius: "6px" }} />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: i < 3 ? "16px" : "0" }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}
            >
              <Skeleton style={{ height: "12px", width: "45%" }} />
              <Skeleton style={{ height: "12px", width: "25%" }} />
            </div>
            <Skeleton style={{ height: "6px", borderRadius: "999px" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for the 50/30/20 BudgetRuleCard (three bucket bars). */
function BudgetRuleCardSkeleton() {
  return (
    <div style={{ ...cardBase, marginBottom: "32px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <Skeleton style={{ height: "11px", width: "150px" }} />
        <Skeleton style={{ height: "20px", width: "20px", borderRadius: "6px" }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: i < 3 ? "20px" : "0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <Skeleton style={{ height: "13px", width: "55px" }} />
              <Skeleton style={{ height: "11px", width: "38px" }} />
            </div>
            <Skeleton style={{ height: "13px", width: "90px" }} />
          </div>
          <Skeleton style={{ height: "10px", borderRadius: "999px" }} />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the Recurring Transactions and Calendar side-by-side cards. */
function RecurringAndCalendarSkeleton({ dashboardColumns }: { dashboardColumns: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: dashboardColumns,
        gap: "20px",
        alignItems: "start",
        marginBottom: "32px",
      }}
    >
      <div style={cardBase}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <Skeleton style={{ height: "11px", width: "90px" }} />
          <Skeleton style={{ height: "22px", width: "22px", borderRadius: "6px" }} />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "10px 0",
              borderBottom: i < 4 ? "1px solid var(--border)" : "none",
            }}
          >
            <Skeleton
              style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <Skeleton style={{ height: "13px", width: "60%", marginBottom: "5px" }} />
              <Skeleton style={{ height: "11px", width: "40%" }} />
            </div>
            <Skeleton style={{ height: "13px", width: "48px" }} />
          </div>
        ))}
      </div>

      <div style={cardBase}>
        <Skeleton style={{ height: "11px", width: "130px", marginBottom: "20px" }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
            marginBottom: "6px",
          }}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} style={{ height: "22px", borderRadius: "4px" }} />
          ))}
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}
        >
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} style={{ height: "30px", borderRadius: "6px" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for the Net Worth History chart card. */
function NetWorthHistorySkeleton() {
  return (
    <div style={{ ...cardBase, marginBottom: "32px" }}>
      <Skeleton style={{ height: "11px", width: "130px", marginBottom: "8px" }} />
      <Skeleton style={{ height: "26px", width: "40%", marginBottom: "20px" }} />
      <Skeleton style={{ height: "200px", borderRadius: "8px" }} />
    </div>
  );
}

/** Skeleton for the Account Balances chart and Open New Account form cards. */
function AccountPanelsSkeleton({ dashboardColumns }: { dashboardColumns: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: dashboardColumns,
        gap: "20px",
        alignItems: "start",
        marginBottom: "32px",
      }}
    >
      <div style={cardBase}>
        <Skeleton style={{ height: "11px", width: "130px", marginBottom: "20px" }} />
        <Skeleton style={{ height: "180px", borderRadius: "8px" }} />
      </div>
      <div style={cardBase}>
        <Skeleton style={{ height: "11px", width: "120px", marginBottom: "8px" }} />
        <Skeleton style={{ height: "22px", width: "60%", marginBottom: "20px" }} />
        <Skeleton style={{ height: "38px", borderRadius: "8px", marginBottom: "10px" }} />
        <Skeleton style={{ height: "38px", borderRadius: "8px", marginBottom: "14px" }} />
        <Skeleton style={{ height: "34px", width: "45%", borderRadius: "8px" }} />
      </div>
    </div>
  );
}

/** Full-page loading skeleton shown while the initial dashboard data fetch is in flight. */
export function DashboardSkeleton({ dashboardColumns }: DashboardSkeletonProps) {
  return (
    <>
      <StatsRowSkeleton />
      <GoalWidgetSkeleton />
      <FinancialHealthSkeleton />
      <InsightsCardSkeleton />
      <SnapshotAndBudgetsSkeleton dashboardColumns={dashboardColumns} />
      <BudgetRuleCardSkeleton />
      <RecurringAndCalendarSkeleton dashboardColumns={dashboardColumns} />
      <NetWorthHistorySkeleton />
      <AccountPanelsSkeleton dashboardColumns={dashboardColumns} />
    </>
  );
}
