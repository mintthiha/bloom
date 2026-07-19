"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink, PlaidLinkOnSuccess } from "react-plaid-link";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { CollapsibleCard } from "@/components/collapsible-card";

interface LinkBankAccountCardProps {
  onLinked: () => Promise<void>;
}

/**
 * Dashboard card that opens Plaid Link for the user to connect an external bank account.
 * Fetches a link token on mount so the modal opens instantly when the button is clicked.
 */
export function LinkBankAccountCard({ onLinked }: LinkBankAccountCardProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  /** Fetches the Plaid link token from the backend. Disables the button if credentials are not configured. */
  useEffect(() => {
    let cancelled = false;
    api
      .createLinkToken()
      .then(({ linkToken: token }) => {
        if (!cancelled) setLinkToken(token);
      })
      .catch(() => {
        if (!cancelled) setTokenError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Exchanges the Plaid public token, syncs accounts, then refreshes the dashboard. */
  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      const institutionName = metadata.institution?.name ?? "External Bank";
      setLinking(true);
      try {
        const result = await api.exchangePublicToken(publicToken, institutionName);
        toast.success(
          `Linked ${result.accountsLinked} account${result.accountsLinked !== 1 ? "s" : ""} from ${institutionName}`
        );
        await onLinked();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to link bank account");
      } finally {
        setLinking(false);
      }
    },
    [onLinked]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
  });

  const buttonReady = ready && !linking && !tokenError;

  return (
    <CollapsibleCard
      eyebrow="Link Bank Account"
      title="Connect an external bank"
      description="Securely link an outside bank account to import its balances and transactions."
      className="fade-up fade-up-2"
      style={{}}
    >
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-secondary)",
          marginBottom: "14px",
          lineHeight: "1.5",
        }}
      >
        Connect an external institution — RBC, Chase, and more — to import your accounts and recent
        transactions automatically.
      </p>

      {tokenError && (
        <p
          style={{
            fontSize: "12px",
            color: "#f87171",
            marginBottom: "12px",
          }}
        >
          Plaid credentials not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to backend/.env to
          enable this feature.
        </p>
      )}

      <button
        type="button"
        onClick={() => open()}
        disabled={!buttonReady}
        style={{
          width: "100%",
          padding: "10px 20px",
          background: buttonReady ? "transparent" : "transparent",
          color: buttonReady ? "#3b82f6" : "var(--text-muted)",
          fontWeight: 700,
          fontSize: "14px",
          border: `1px solid ${buttonReady ? "#3b82f655" : "var(--border)"}`,
          borderRadius: "8px",
          cursor: buttonReady ? "pointer" : "not-allowed",
          opacity: buttonReady ? 1 : 0.5,
          transition: "opacity 0.15s, border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          if (buttonReady) e.currentTarget.style.borderColor = "#3b82f6";
        }}
        onMouseLeave={(e) => {
          if (buttonReady) e.currentTarget.style.borderColor = "#3b82f655";
        }}
      >
        {linking
          ? "Linking..."
          : tokenError
            ? "Not configured"
            : !linkToken
              ? "Connecting..."
              : "Link Bank Account"}
      </button>
    </CollapsibleCard>
  );
}
