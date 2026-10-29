"use client";

import Link from "next/link";

/** Back-to-accounts navigation link used on account detail pages, mirroring BackToHome. */
export function BackToAccounts() {
  return (
    <Link
      href="/accounts"
      className="fade-up back-link"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "12px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        textDecoration: "none",
        marginBottom: "32px",
      }}
    >
      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to Accounts
    </Link>
  );
}
