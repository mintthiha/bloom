"use client";

import { BackToHome } from "@/components/BackToHome";
import { TransactionsExplorer } from "./_components/_transactionsExplorer/TransactionsExplorer";

/** Dedicated page listing every transaction across all accounts, with filtering, sorting, and paging. */
export default function TransactionsPage() {
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px 48px",
      }}
    >
      <BackToHome />

      <div className="fade-up" style={{ marginBottom: "28px" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            marginBottom: "6px",
          }}
        >
          Transactions
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          Every deposit, withdrawal, and transfer across all your accounts in one place.
        </p>
      </div>

      <div className="fade-up fade-up-1">
        <TransactionsExplorer />
      </div>
    </div>
  );
}
